import axios from 'axios';
import crypto from 'crypto';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/AppError.js';
import { assertPolicyAccepted } from '../utils/verificationHelpers.js';
import {
    sendBookingConfirmationEmail,
    rideBookingEmailHtml,
} from '../utils/bookingEmail.js';

const UBER_AUTH_URL = 'https://login.uber.com/oauth/v2/authorize';
const UBER_TOKEN_URL = 'https://auth.uber.com/oauth/v2/token';
const UBER_API_BASE_URL = 'https://api.uber.com/v1.2';
const OLA_API_BASE_URL = 'https://devapi.olacabs.com/v1';

const SUPPORTED_PROVIDERS = ['UBER', 'OLA', 'RAPIDO', 'ZOOMCAR'];

const normalizeProvider = (provider = '') => provider.toUpperCase();

const isConfigured = {
    UBER: () => Boolean(process.env.UBER_CLIENT_ID && process.env.UBER_CLIENT_SECRET && process.env.UBER_REDIRECT_URI),
    OLA: () => Boolean(process.env.OLA_APP_TOKEN),
    RAPIDO: () => Boolean(process.env.RAPIDO_PARTNER_API_KEY),
    ZOOMCAR: () => Boolean(process.env.ZOOMCAR_PARTNER_API_KEY),
};

const providerSetup = {
    UBER: 'Add UBER_CLIENT_ID, UBER_CLIENT_SECRET, and UBER_REDIRECT_URI. Uber ride requests require approved OAuth scopes for production users.',
    OLA: 'Add OLA_APP_TOKEN from the Ola Developer Platform. User-specific upfront fares and booking require Ola partner authorization.',
    RAPIDO: 'Add RAPIDO_PARTNER_API_KEY after receiving partner API access from Rapido. Public consumer login is not supported here.',
    ZOOMCAR: 'Add ZOOMCAR_PARTNER_API_KEY after receiving partner API access from Zoomcar. Public consumer login is not supported here.',
};

const requireCoordinates = (query) => {
    const startLatitude = Number(query.pickupLat);
    const startLongitude = Number(query.pickupLng);
    const endLatitude = Number(query.dropoffLat);
    const endLongitude = Number(query.dropoffLng);

    if (![startLatitude, startLongitude, endLatitude, endLongitude].every(Number.isFinite)) {
        throw new AppError('Real provider comparison requires pickupLat, pickupLng, dropoffLat, and dropoffLng.', 400);
    }

    return { startLatitude, startLongitude, endLatitude, endLongitude };
};

const getProviderStatusList = () => SUPPORTED_PROVIDERS.map((provider) => ({
    provider,
    isConfigured: isConfigured[provider](),
    setup: isConfigured[provider]() ? null : providerSetup[provider],
}));

const refreshUberToken = async (account) => {
    if (!account?.refreshToken) return account;
    if (account.expiresAt && new Date(account.expiresAt) > new Date(Date.now() + 60_000)) {
        return account;
    }

    try {
        const params = new URLSearchParams({
            client_id: process.env.UBER_CLIENT_ID,
            client_secret: process.env.UBER_CLIENT_SECRET,
            grant_type: 'refresh_token',
            redirect_uri: process.env.UBER_REDIRECT_URI?.trim(),
            refresh_token: account.refreshToken,
        });
        const tokenRes = await axios.post(UBER_TOKEN_URL, params.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        const { access_token, refresh_token, expires_in } = tokenRes.data;

        return prisma.linkedAccount.update({
            where: { id: account.id },
            data: {
                accessToken: access_token,
                refreshToken: refresh_token || account.refreshToken,
                expiresAt: new Date(Date.now() + expires_in * 1000),
                isConnected: true,
            },
        });
    } catch (err) {
        console.error('Uber token refresh failed:', err.response?.data || err.message);
        return account;
    }
};

const getUberOptions = async ({ account, coordinates }) => {
    if (!account?.accessToken) return [];

    const freshAccount = await refreshUberToken(account);

    const productsRes = await axios.get(`${UBER_API_BASE_URL}/products`, {
        params: {
            latitude: coordinates.startLatitude,
            longitude: coordinates.startLongitude,
        },
        headers: { Authorization: `Bearer ${freshAccount.accessToken}` },
    });

    const products = productsRes.data?.products || [];
    const estimates = await Promise.all(products.slice(0, 4).map(async (product) => {
        try {
            const estimateRes = await axios.post(`${UBER_API_BASE_URL}/requests/estimate`, {
                product_id: product.product_id,
                start_latitude: coordinates.startLatitude,
                start_longitude: coordinates.startLongitude,
                end_latitude: coordinates.endLatitude,
                end_longitude: coordinates.endLongitude,
            }, {
                headers: { Authorization: `Bearer ${freshAccount.accessToken}` },
            });

            return {
                provider: 'Uber',
                providerProductId: product.product_id,
                vehicleType: product.display_name,
                price: estimateRes.data?.fare?.value || estimateRes.data?.fare?.fare_id || null,
                currency: estimateRes.data?.fare?.currency_code || 'INR',
                eta: estimateRes.data?.trip?.eta || null,
                capacity: product.capacity || null,
                type: 'REAL',
            };
        } catch (err) {
            console.error('Uber estimate failed:', err.response?.data || err.message);
            return null;
        }
    }));

    return estimates.filter(Boolean);
};

const getOlaOptions = async ({ coordinates, type }) => {
    if (!isConfigured.OLA()) return [];

    const serviceType = type === 'OUTERCITY' ? 'outstation' : type === 'INTERCITY' ? 'outstation' : 'p2p';
    const res = await axios.get(`${OLA_API_BASE_URL}/products`, {
        params: {
            pickup_lat: coordinates.startLatitude,
            pickup_lng: coordinates.startLongitude,
            drop_lat: coordinates.endLatitude,
            drop_lng: coordinates.endLongitude,
            service_type: serviceType,
        },
        headers: { 'X-APP-TOKEN': process.env.OLA_APP_TOKEN },
    });

    const categories = res.data?.categories || res.data?.ride_estimate || [];
    return categories.map((item) => ({
        provider: 'Ola',
        providerProductId: item.id || item.category,
        vehicleType: item.display_name || item.category || 'Ola ride',
        price: item.ride_estimate?.amount_max || item.amount_max || item.fare_breakup?.[0]?.minimum_fare || null,
        currency: item.currency || 'INR',
        eta: item.eta || null,
        capacity: item.capacity || null,
        type: 'REAL',
    }));
};

// GET /api/rides/providers
export const getProviderStatus = async (_req, res) => {
    res.json({ success: true, data: getProviderStatusList() });
};

// GET /api/rides/compare
export const getRideOptions = async (req, res) => {
    const { pickup, dropoff, type = 'LOCAL' } = req.query;
    if (!pickup || !dropoff) throw new AppError('Pickup and dropoff locations are required.', 400);

    const coordinates = requireCoordinates(req.query);
    const linkedAccounts = await prisma.linkedAccount.findMany({
        where: { userId: req.user.id, isConnected: true },
    });
    const accountByProvider = new Map(linkedAccounts.map((account) => [account.provider, account]));
    const options = [];

    if (accountByProvider.has('UBER') && isConfigured.UBER()) {
        options.push(...await getUberOptions({ account: accountByProvider.get('UBER'), coordinates }));
    }

    if (isConfigured.OLA()) {
        options.push(...await getOlaOptions({ coordinates, type }));
    }

    if (accountByProvider.has('RAPIDO')) {
        throw new AppError(providerSetup.RAPIDO, 501);
    }

    if (accountByProvider.has('ZOOMCAR')) {
        throw new AppError(providerSetup.ZOOMCAR, 501);
    }

    if (options.length === 0) {
        throw new AppError('No provider results available. Connect Uber and/or configure Ola, Rapido, or Zoomcar credentials in backend/.env.', 503);
    }

    res.json({ success: true, data: options });
};

// GET /api/rides/linked-accounts
export const getLinkedAccounts = async (req, res) => {
    const accounts = await prisma.linkedAccount.findMany({
        where: { userId: req.user.id },
        select: { id: true, provider: true, isConnected: true, expiresAt: true, createdAt: true, updatedAt: true },
    });
    res.json({ success: true, data: accounts });
};

// GET /api/rides/uber/setup
export const getUberSetup = async (_req, res) => {
    const redirectUri = process.env.UBER_REDIRECT_URI?.trim();
    res.json({
        success: true,
        data: {
            isConfigured: isConfigured.UBER(),
            redirectUri,
            registerSteps: [
                'Open https://developer.uber.com/dashboard',
                'Setup tab → add Redirect URI: http://localhost:3001/api/rides/auth/uber/callback',
                'Setup tab → Privacy Policy URL (any valid https or http://localhost URL)',
                'Auth / Scopes tab → enable scopes for your app (or Request Scopes if using Others suite)',
                'Do NOT send scopes in code — we use whatever you enable in the dashboard',
                'Save, then try Connect Uber again',
            ],
            invalidScopeHelp: 'If you see invalid_scope: open Uber Dashboard → your app → Setup/Auth → enable scopes there. Apps on "Others" suite may need Uber to grant scopes first.',
        },
    });
};

// POST /api/rides/link-account
export const linkAccount = async (req, res) => {
    const provider = normalizeProvider(req.body.provider);
    if (!SUPPORTED_PROVIDERS.includes(provider)) throw new AppError('Invalid provider', 400);
    if (!isConfigured[provider]()) throw new AppError(providerSetup[provider], 501);

    if (provider !== 'UBER') {
        throw new AppError(`${provider} account linking requires official partner onboarding. Do not collect consumer app passwords in this app.`, 501);
    }

    const redirectUri = process.env.UBER_REDIRECT_URI?.trim();
    if (!redirectUri) {
        throw new AppError('UBER_REDIRECT_URI is missing in backend/.env', 500);
    }

    const stateNonce = crypto.randomBytes(16).toString('hex');
    const state = Buffer.from(JSON.stringify({ userId: req.user.id, stateNonce })).toString('base64url');
    const query = new URLSearchParams({
        client_id: process.env.UBER_CLIENT_ID,
        response_type: 'code',
        redirect_uri: redirectUri,
        state,
    }).toString();

    res.json({
        success: true,
        redirectUrl: `${UBER_AUTH_URL}?${query}`,
        redirectUri,
        hint: 'Add redirect URI in Uber Dashboard if login fails.',
    });
};

const uberFailPage = (reason) => `<html><body><script>
window.opener?.postMessage({ type: 'UBER_FAILED', reason: ${JSON.stringify(reason)} }, '*');
window.close();
</script><p>Uber connection failed: ${reason}</p></body></html>`;

// GET /api/rides/auth/uber/callback
export const handleUberCallback = async (req, res) => {
    const { code, state, error, error_description: errorDescription } = req.query;

    if (error) {
        const reason = errorDescription || error;
        console.error('Uber OAuth error:', reason);
        return res.send(uberFailPage(reason));
    }

    if (!code || !state) {
        return res.send(uberFailPage('Missing authorization code from Uber.'));
    }

    try {
        const parsedState = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
        const redirectUri = process.env.UBER_REDIRECT_URI?.trim();
        const params = new URLSearchParams({
            client_id: process.env.UBER_CLIENT_ID,
            client_secret: process.env.UBER_CLIENT_SECRET,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri,
            code,
        });

        const tokenRes = await axios.post(UBER_TOKEN_URL, params.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        const { access_token, refresh_token, expires_in } = tokenRes.data;

        await prisma.linkedAccount.upsert({
            where: { userId_provider: { userId: parsedState.userId, provider: 'UBER' } },
            update: {
                accessToken: access_token,
                refreshToken: refresh_token,
                expiresAt: new Date(Date.now() + expires_in * 1000),
                isConnected: true,
            },
            create: {
                userId: parsedState.userId,
                provider: 'UBER',
                accessToken: access_token,
                refreshToken: refresh_token,
                expiresAt: new Date(Date.now() + expires_in * 1000),
                isConnected: true,
            },
        });

        res.send('<html><body><script>window.opener?.postMessage({ type: "UBER_CONNECTED" }, "*"); window.close();</script>Uber connected. You can close this tab.</body></html>');
    } catch (err) {
        const reason = err.response?.data?.error_description
            || err.response?.data?.error
            || err.message
            || 'Token exchange failed';
        console.error('Uber Token Exchange Error:', err.response?.data || err.message);
        res.send(uberFailPage(reason));
    }
};

// POST /api/rides/auth/otp/send
export const sendOTP = async () => {
    throw new AppError('Provider OTP login is not supported. Use official provider OAuth or partner APIs only.', 410);
};

// POST /api/rides/auth/otp/verify
export const verifyOTP = async () => {
    throw new AppError('Provider OTP login is not supported. Use official provider OAuth or partner APIs only.', 410);
};

// POST /api/rides/book
export const bookRide = async (req, res) => {
    await assertPolicyAccepted(req.user.id, 'RIDE_TERMS');

    const { provider, vehicleType, pickupLocation, dropoffLocation, fare, currency, type } = req.body;

    if (!provider || !pickupLocation || !dropoffLocation) {
        throw new AppError('Provider, pickup, and dropoff are required.', 400);
    }

    const ride = await prisma.rideBooking.create({
        data: {
            userId: req.user.id,
            provider,
            pickupLocation,
            dropoffLocation,
            fare: Number(fare) || 0,
            currency: currency || 'INR',
            status: 'BOOKING_REQUESTED',
            type: type || 'LOCAL',
            providerRideId: vehicleType,
        },
    });

    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { email: true, name: true },
        });
        await sendBookingConfirmationEmail({
            to: user?.email,
            subject: `Ride booking — ${provider} ${vehicleType || ''}`.trim(),
            html: rideBookingEmailHtml({
                userName: user?.name || req.user.name,
                provider,
                vehicleType: vehicleType || 'Ride',
                pickup: pickupLocation,
                dropoff: dropoffLocation,
                fare: Number(fare) || 0,
                currency: currency || 'INR',
            }),
        });
    } catch (err) {
        console.error('[Ride booking email]', err.message);
    }

    res.status(201).json({ success: true, data: ride });
};

// GET /api/rides/my
export const getMyRides = async (req, res) => {
    const rides = await prisma.rideBooking.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: rides });
};
