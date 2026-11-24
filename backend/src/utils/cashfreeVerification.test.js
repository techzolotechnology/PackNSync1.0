import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    createCashfreeDigiLockerUrl,
    fetchCashfreeDigiLockerStatus,
    isCashfreeRedirectUrl,
    verifyCashfreeDrivingLicense,
} from './cashfreeVerification.js';

const savedEnv = { ...process.env };

afterEach(() => {
    vi.unstubAllGlobals();
    for (const key of Object.keys(process.env)) {
        if (!(key in savedEnv)) delete process.env[key];
    }
    Object.assign(process.env, savedEnv);
});

describe('Cashfree Secure ID client', () => {
    it('creates a DigiLocker consent URL with the expected authenticated request', async () => {
        process.env.CASHFREE_VERIFICATION_CLIENT_ID = 'client';
        process.env.CASHFREE_VERIFICATION_CLIENT_SECRET = 'secret';
        process.env.CASHFREE_VERIFICATION_ENV = 'sandbox';
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url: 'https://verification.cashfree.com/dgl/test' }) });
        vi.stubGlobal('fetch', fetchMock);

        const result = await createCashfreeDigiLockerUrl({ verificationId: 'verify-123', redirectUrl: 'https://pickandsync.com/verify' });

        expect(result.url).toContain('cashfree.com');
        const [url, options] = fetchMock.mock.calls[0];
        expect(String(url)).toBe('https://sandbox.cashfree.com/verification/digilocker');
        expect(options.method).toBe('POST');
        expect(options.headers).toMatchObject({ 'x-client-id': 'client', 'x-client-secret': 'secret' });
        expect(options.body).toBe(JSON.stringify({ verification_id: 'verify-123', document_requested: ['AADHAAR'], redirect_url: 'https://pickandsync.com/verify' }));
    });

    it('checks DigiLocker status and encodes the verification reference', async () => {
        process.env.CASHFREE_VERIFICATION_CLIENT_ID = 'client';
        process.env.CASHFREE_VERIFICATION_CLIENT_SECRET = 'secret';
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'AUTHENTICATED' }) });
        vi.stubGlobal('fetch', fetchMock);

        await fetchCashfreeDigiLockerStatus('ref with space');

        expect(String(fetchMock.mock.calls[0][0])).toBe('https://sandbox.cashfree.com/verification/digilocker?verification_id=ref+with+space');
    });

    it('sends driving licence number and date only to the provider', async () => {
        process.env.CASHFREE_VERIFICATION_CLIENT_ID = 'client';
        process.env.CASHFREE_VERIFICATION_CLIENT_SECRET = 'secret';
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'VALID' }) });
        vi.stubGlobal('fetch', fetchMock);

        await verifyCashfreeDrivingLicense({ verificationId: 'verify-456', licenseNumber: 'DL12345678', dateOfBirth: '1990-01-02' });

        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ verification_id: 'verify-456', dl_number: 'DL12345678', dob: '1990-01-02' });
    });

    it('only accepts HTTPS provider links hosted by Cashfree', () => {
        expect(isCashfreeRedirectUrl('https://verification.cashfree.com/dgl')).toBe(true);
        expect(isCashfreeRedirectUrl('http://verification.cashfree.com/dgl')).toBe(false);
        expect(isCashfreeRedirectUrl('https://cashfree.com.attacker.example/dgl')).toBe(false);
    });
});
