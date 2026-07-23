import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import './RidesPage.css';
import { ridesApi, verificationsApi } from '../api/index.js';
import LocationAutocomplete from '../components/LocationAutocomplete.jsx';
import ServiceLoginModal from '../components/ServiceLoginModal.jsx';
import TermsAcceptanceModal from '../components/TermsAcceptanceModal.jsx';
import { useAuthStore } from '../store/authStore.js';
import { reverseGeocode } from '../utils/geocode.js';
import { PROVIDER_DEEP_LINKS, openProviderApp } from '../utils/providerLinks.js';

export default function RidesPage() {
    const user = useAuthStore((s) => s.user);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [pickup, setPickup] = useState('');
    const [dropoff, setDropoff] = useState('');
    const [pickupCoords, setPickupCoords] = useState(null);
    const [dropoffCoords, setDropoffCoords] = useState(null);
    const [type, setType] = useState('LOCAL');
    const [options, setOptions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [gpsLoading, setGpsLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [linkedProviders, setLinkedProviders] = useState([]);
    const [providerMessage, setProviderMessage] = useState('');
    const [providers, setProviders] = useState([]);
    const [termsOpen, setTermsOpen] = useState(false);
    const [termsLoading, setTermsLoading] = useState(false);
    const [pendingBook, setPendingBook] = useState(null);
    const [showProviderFallback, setShowProviderFallback] = useState(false);
    const uberErrorShown = useRef(false);

    const refreshLinkedAccounts = async () => {
        try {
            const res = await ridesApi.getLinkedAccounts();
            setLinkedProviders(res.data.data.filter((a) => a.isConnected).map((a) => a.provider));
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        if (user) refreshLinkedAccounts();
    }, [user]);

    useEffect(() => {
        ridesApi.getProviders()
            .then((res) => setProviders(res.data.data || []))
            .catch(() => {});
    }, []);

    useEffect(() => {
        const err = searchParams.get('error');
        const reason = searchParams.get('reason');
        if (err === 'uber_auth_failed' && !uberErrorShown.current) {
            uberErrorShown.current = true;
            toast.error(reason ? `Uber failed: ${decodeURIComponent(reason)}` : 'Uber connection failed. Check redirect URI in Uber Dashboard.');
            navigate('/rides', { replace: true });
        }
    }, [searchParams, navigate]);

    const handleSearch = async (e) => {
        if (e) e.preventDefault();

        if (!user) {
            navigate('/login');
            return;
        }

        if (!pickup || !dropoff) {
            toast.error('Please enter pickup and dropoff locations.');
            return;
        }

        if (!pickupCoords || !dropoffCoords) {
            toast.error('Select both locations from the dropdown suggestions (or use Current for pickup).');
            return;
        }

        if (!linkedProviders.includes('UBER') && providers.find((p) => p.provider === 'UBER')?.isConfigured) {
            toast('Connect Uber for live Uber fares. Ola/Rapido/Zoomcar need API keys when you add them.', { icon: 'ℹ️' });
        }

        setLoading(true);
        setProviderMessage('');
        setShowProviderFallback(false);
        try {
            const res = await ridesApi.compare({
                pickup,
                dropoff,
                pickupLat: pickupCoords.lat,
                pickupLng: pickupCoords.lng,
                dropoffLat: dropoffCoords.lat,
                dropoffLng: dropoffCoords.lng,
                type,
            });
            const sorted = [...res.data.data].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
            setOptions(sorted);
            if (sorted.length === 0) {
                setProviderMessage('No fares returned from live APIs. Open a provider app below to book directly.');
                setShowProviderFallback(true);
            }
        } catch (err) {
            setOptions([]);
            setProviderMessage(err.response?.data?.message || 'Ride comparison failed. Use provider apps as a fallback.');
            setShowProviderFallback(true);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenProvider = (providerId) => {
        const opened = openProviderApp(providerId, pickup, dropoff);
        if (!opened) toast.error('Could not open provider link.');
    };

    const completeBook = async (option) => {
        try {
            await ridesApi.book({
                provider: option.provider,
                providerProductId: option.providerProductId,
                vehicleType: option.vehicleType,
                pickupLocation: pickup,
                dropoffLocation: dropoff,
                fare: option.price,
                currency: option.currency,
                type,
            });
            toast.success(`Booking requested for ${option.provider} ${option.vehicleType}.`);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Booking failed.');
        }
    };

    const handleBook = async (option) => {
        try {
            const policyRes = await verificationsApi.getPolicyStatus();
            if (!policyRes.data.data?.status?.RIDE_TERMS) {
                setPendingBook(option);
                setTermsOpen(true);
                return;
            }
            await completeBook(option);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Unable to start booking.');
        }
    };

    const handleTermsAccept = async () => {
        setTermsLoading(true);
        try {
            await verificationsApi.acceptPolicy('RIDE_TERMS');
            setTermsOpen(false);
            if (pendingBook) {
                await completeBook(pendingBook);
                setPendingBook(null);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not save acceptance.');
        } finally {
            setTermsLoading(false);
        }
    };

    const handleGPS = () => {
        if (!navigator.geolocation) {
            toast.error('Geolocation is not supported in this browser.');
            return;
        }

        setGpsLoading(true);
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setPickupCoords(coords);
                const address = await reverseGeocode(coords.lat, coords.lng);
                setPickup(address || `Current location (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`);
                setGpsLoading(false);
                if (!address) toast('GPS set. Add Google Maps key for address name.', { icon: '📍' });
            },
            () => {
                setGpsLoading(false);
                toast.error('Could not get your location. Allow location permission and try again.');
            },
            { enableHighAccuracy: true, timeout: 15000 }
        );
    };

    const handleConnected = (provider) => {
        setLinkedProviders((prev) => (prev.includes(provider) ? prev : [...prev, provider]));
    };

    const coordsReady = pickupCoords && dropoffCoords;

    return (
        <div className="rides-container">
            <div className="rides-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div>
                        <h1>Find Your Next Ride</h1>
                        <p>Compare fares from Uber, Ola, Rapido, and Zoomcar as you connect each provider.</p>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={() => (user ? setIsModalOpen(true) : navigate('/login'))}>
                        Connect Providers
                    </button>
                </div>
            </div>

            <form className="search-box" onSubmit={handleSearch}>
                <div className="input-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <label>Pickup Location</label>
                        <button
                            type="button"
                            onClick={handleGPS}
                            disabled={gpsLoading}
                            style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: '0.8rem', cursor: 'pointer' }}
                        >
                            {gpsLoading ? 'Locating…' : '📍 Current'}
                        </button>
                    </div>
                    <LocationAutocomplete
                        placeholder="e.g. Airport, Bangalore"
                        value={pickup}
                        onChange={(value) => { setPickup(value); setPickupCoords(null); }}
                        onSelect={(location) => {
                            setPickup(location.label || location);
                            setPickupCoords(location.lat ? { lat: location.lat, lng: location.lng } : null);
                        }}
                    />
                </div>
                <div className="input-group">
                    <label>Dropoff Location</label>
                    <LocationAutocomplete
                        placeholder="e.g. Mysore, Coorg, HSR Layout"
                        value={dropoff}
                        onChange={(value) => { setDropoff(value); setDropoffCoords(null); }}
                        onSelect={(location) => {
                            setDropoff(location.label || location);
                            setDropoffCoords(location.lat ? { lat: location.lat, lng: location.lng } : null);
                        }}
                    />
                </div>
                <div className="input-group">
                    <label>Trip Type</label>
                    <select value={type} onChange={(e) => setType(e.target.value)}>
                        <option value="LOCAL">Local</option>
                        <option value="INTERCITY">Inter-City</option>
                        <option value="OUTERCITY">Outer-City</option>
                    </select>
                </div>
                {providers.some((p) => !p.isConfigured) && (
                    <p style={{ fontSize: '0.85rem', color: '#b45309', marginBottom: '0.5rem' }}>
                        Some providers need API keys in backend/.env (Uber, Ola, Rapido, Zoomcar).
                    </p>
                )}
                {coordsReady && !linkedProviders.includes('UBER') && providers.find((p) => p.provider === 'UBER')?.isConfigured && (
                    <p style={{ fontSize: '0.85rem', color: '#6366f1', marginBottom: '0.5rem' }}>
                        Locations ready — connect Uber for live Uber fares.
                    </p>
                )}
                <button type="submit" className="search-btn" disabled={loading}>
                    {loading ? 'Searching...' : 'Compare Prices'}
                </button>
            </form>

            {providerMessage && (
                <div className="provider-message">
                    {providerMessage}
                </div>
            )}

            {showProviderFallback && pickup && dropoff && (
                <div className="provider-fallback">
                    <h3>Book in provider app</h3>
                    <p>Live fare APIs may be unavailable. Open Uber, Ola, Rapido, or Zoomcar with your route pre-filled.</p>
                    <div className="provider-fallback-grid">
                        {PROVIDER_DEEP_LINKS.map((p) => (
                            <button
                                key={p.id}
                                type="button"
                                className="provider-fallback-btn"
                                style={{ background: p.color, color: p.textDark ? '#111' : '#fff' }}
                                onClick={() => handleOpenProvider(p.id)}
                            >
                                Open {p.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="results-section">
                {options.length > 0 ? (
                    <div className="options-grid">
                        {options.map((opt, idx) => (
                            <div key={`${opt.provider}-${opt.vehicleType}-${idx}`} className="ride-card">
                                <div className="provider-info">
                                    <div className={`provider-logo ${opt.provider.toLowerCase()}`}>
                                        {opt.provider[0]}
                                    </div>
                                    <div>
                                        <h3>{opt.provider} {opt.vehicleType}</h3>
                                        <span>{opt.eta ? `${opt.eta} mins away` : 'ETA unavailable'} • {opt.capacity || '-'} Seats</span>
                                    </div>
                                </div>
                                <div className="price-info">
                                    <div className="amount">
                                        {opt.price != null ? `${opt.currency === 'INR' ? '₹' : opt.currency + ' '}${opt.price}` : 'Fare on request'}
                                    </div>
                                    <div className="ride-card-actions">
                                        <button className="book-btn" onClick={() => handleBook(opt)}>Book</button>
                                        <button
                                            type="button"
                                            className="open-app-btn"
                                            onClick={() => handleOpenProvider(opt.provider.toLowerCase())}
                                        >
                                            Open app
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : !loading && (
                    <div className="empty-state">
                        <img src="https://cdni.iconscout.com/illustration/premium/thumb/car-searching-illustration-download-in-svg-png-gif-file-formats--vehicle-magnifying-glass-tax-security-finance-pack-business-illustrations-4796328.png" alt="Search" />
                        <p>
                            Connect providers, pick locations from suggestions, then compare prices across Uber, Ola, Rapido, and Zoomcar.
                        </p>
                    </div>
                )}
            </div>

            <ServiceLoginModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onConnected={handleConnected}
                linkedProviders={linkedProviders}
            />

            <TermsAcceptanceModal
                isOpen={termsOpen}
                policyType="RIDE_TERMS"
                onAccept={handleTermsAccept}
                onClose={() => { setTermsOpen(false); setPendingBook(null); }}
                loading={termsLoading}
            />
        </div>
    );
}
