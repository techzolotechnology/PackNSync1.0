import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { rentalsApi, verificationsApi } from '../api/index.js';
import { useAuthStore } from '../store/authStore.js';
import TermsAcceptanceModal from '../components/TermsAcceptanceModal.jsx';
import './RentalsPage.css';

const today = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

const FALLBACK_IMAGES = [
    'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=900&q=80',
];

const CATEGORIES = [
    {
        id: 'luxury',
        label: 'Luxury Sedans',
        accent: 'teal',
        icon: 'sedan',
        thumb: FALLBACK_IMAGES[3],
        match: (v) => /bmw|mercedes|audi|jaguar|lexus|city|sedan|honda/i.test(`${v.make} ${v.model}`),
    },
    {
        id: 'suv',
        label: 'SUVs',
        accent: 'orange',
        icon: 'suv',
        thumb: FALLBACK_IMAGES[1],
        match: (v) => /suv|xuv|fortuner|harrier|scorpio|endeavour|creta|mahindra|toyota|hyundai/i.test(`${v.make} ${v.model} ${v.type || ''}`),
    },
    {
        id: 'electric',
        label: 'Electric Cars',
        accent: 'orange',
        icon: 'ev',
        thumb: FALLBACK_IMAGES[2],
        match: (v) => /electric|ev|nexon|tiago/i.test(`${v.fuelType} ${v.make} ${v.model}`),
    },
    {
        id: 'classics',
        label: 'Classics',
        accent: 'orange',
        icon: 'classic',
        thumb: FALLBACK_IMAGES[0],
        match: (v) => /classic|ambassador|contessa/i.test(`${v.make} ${v.model}`) || (Number(v.year) > 0 && Number(v.year) < 2000),
    },
];

const getDays = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return Math.max(1, Math.ceil((end - start) / 86400000));
};

function CategoryIcon({ type }) {
    if (type === 'ev') {
        return (
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
                <path d="M13 3L6 14h5l-1 7 8-12h-5l0-6z" fill="currentColor" />
            </svg>
        );
    }
    if (type === 'suv') {
        return (
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
                <path d="M4 14h16l-1.2-4.2A3 3 0 0 0 15.9 8H8.1a3 3 0 0 0-2.9 1.8L4 14z" stroke="currentColor" strokeWidth="1.6" />
                <circle cx="7.5" cy="15.5" r="1.5" fill="currentColor" />
                <circle cx="16.5" cy="15.5" r="1.5" fill="currentColor" />
            </svg>
        );
    }
    if (type === 'classic') {
        return (
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
                <path d="M5 15h14l-1-4H6l-1 4zM7 11l1.5-3h7L17 11" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                <circle cx="8" cy="16" r="1.4" fill="currentColor" />
                <circle cx="16" cy="16" r="1.4" fill="currentColor" />
            </svg>
        );
    }
    return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
            <path d="M4 15h16l-1.5-5H5.5L4 15z" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="7.5" cy="16.2" r="1.4" fill="currentColor" />
            <circle cx="16.5" cy="16.2" r="1.4" fill="currentColor" />
        </svg>
    );
}

export default function RentalsPage() {
    const user = useAuthStore((s) => s.user);
    const navigate = useNavigate();
    const [listings, setListings] = useState([]);
    const [location, setLocation] = useState('');
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(tomorrow);
    const [priceMin, setPriceMin] = useState(50);
    const [priceMax, setPriceMax] = useState(500);
    const [category, setCategory] = useState('');
    const [sortBy, setSortBy] = useState('price');
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [pendingListing, setPendingListing] = useState(null);
    const [termsOpen, setTermsOpen] = useState(false);
    const [termsLoading, setTermsLoading] = useState(false);

    const rentalDays = useMemo(() => getDays(startDate, endDate), [startDate, endDate]);

    useEffect(() => {
        fetchListings();
    }, []);

    const fetchListings = async () => {
        setLoading(true);
        setLoadError('');
        try {
            const res = await rentalsApi.getListings({
                location,
                startDate,
                endDate,
            });
            setListings(res.data.data || []);
        } catch (err) {
            setListings([]);
            setLoadError(err.response?.data?.message || 'Unable to load rental listings.');
        } finally {
            setLoading(false);
        }
    };

    const priceScale = useMemo(() => {
        const maxBound = Math.max(...listings.map((x) => Number(x.pricePerDay) || 0), 500);
        const useInr = maxBound > 1000;
        const factor = useInr ? 40 : 1;
        const symbol = useInr ? '₹' : '$';
        const fmt = (n) => `${symbol}${Math.round(n * factor).toLocaleString()}`;
        return {
            useInr,
            factor,
            symbol,
            fmt,
            displayMin: fmt(priceMin),
            displayMax: fmt(priceMax),
            floor: fmt(50),
            ceil: fmt(500),
        };
    }, [listings, priceMin, priceMax]);

    const filtered = useMemo(() => {
        let rows = [...listings];
        const cat = CATEGORIES.find((c) => c.id === category);
        if (cat) rows = rows.filter((l) => cat.match(l.vehicle));

        const min = priceMin * priceScale.factor;
        const max = priceMax * priceScale.factor;
        rows = rows.filter((l) => {
            const p = Number(l.pricePerDay);
            return p >= min && p <= max;
        });

        if (sortBy === 'price') rows.sort((a, b) => a.pricePerDay - b.pricePerDay);
        if (sortBy === 'price-desc') rows.sort((a, b) => b.pricePerDay - a.pricePerDay);
        return rows;
    }, [listings, category, priceMin, priceMax, sortBy, priceScale.factor]);

    const handleSearch = (e) => {
        e?.preventDefault?.();
        fetchListings();
    };

    const completeBooking = async (listing) => {
        try {
            await rentalsApi.book({ listingId: listing.id, startDate, endDate });
            toast.success(`Booking request sent. Total: ₹${Number(listing.pricePerDay * rentalDays).toLocaleString()}`);
        } catch (err) {
            const msg = err.response?.data?.message || 'Booking failed.';
            if (msg.includes('verification') || msg.includes('KYC')) {
                toast.error(msg);
                navigate('/verify');
                return;
            }
            toast.error(msg);
        }
    };

    const handleBook = async (listing) => {
        if (!user) {
            navigate('/login');
            return;
        }
        try {
            const statusRes = await verificationsApi.getStatus();
            if (!statusRes.data.data?.isFullyVerified) {
                toast.error('Complete identity verification before renting.');
                navigate('/verify');
                return;
            }
            const policyRes = await verificationsApi.getPolicyStatus();
            if (!policyRes.data.data?.status?.RENTAL_TERMS) {
                setPendingListing(listing);
                setTermsOpen(true);
                return;
            }
            await completeBooking(listing);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Unable to start booking.');
        }
    };

    const handleTermsAccept = async () => {
        setTermsLoading(true);
        try {
            await verificationsApi.acceptPolicy('RENTAL_TERMS');
            setTermsOpen(false);
            if (pendingListing) {
                await completeBooking(pendingListing);
                setPendingListing(null);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not save acceptance.');
        } finally {
            setTermsLoading(false);
        }
    };

    return (
        <div className="cr-page page-enter">
            <section className="cr-hero">
                <div className="cr-hero-media" aria-hidden="true" />
                <div className="cr-hero-fx" aria-hidden="true">
                    <svg className="cr-waves" viewBox="0 0 1440 420" preserveAspectRatio="none">
                        <path d="M-40,280 C200,140 380,340 560,220 C740,100 920,300 1100,200 C1280,100 1400,260 1520,180" />
                        <path d="M-40,320 C220,180 400,360 580,250 C760,140 940,330 1120,240 C1300,150 1420,300 1520,220" />
                    </svg>
                    <div className="cr-bokeh">
                        {Array.from({ length: 14 }).map((_, i) => <span key={i} />)}
                    </div>
                </div>

                <div className="container cr-hero-inner">
                    <h1>Car on Rent</h1>
                    <p>Self-drive cars from community hosts — weekends, outer-city runs, your schedule.</p>

                    <form className="cr-search" onSubmit={handleSearch}>
                        <label className="cr-field">
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                                <path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11z" stroke="currentColor" strokeWidth="1.7" />
                                <circle cx="12" cy="10" r="2.2" fill="currentColor" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Location"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                            />
                        </label>

                        <label className="cr-field">
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                                <rect x="3.5" y="5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.7" />
                                <path d="M8 3.5v3M16 3.5v3M3.5 10h17" stroke="currentColor" strokeWidth="1.7" />
                            </svg>
                            <input type="date" value={startDate} min={today} onChange={(e) => setStartDate(e.target.value)} />
                            <span className="cr-date-sep">–</span>
                            <input type="date" value={endDate} min={startDate || today} onChange={(e) => setEndDate(e.target.value)} />
                        </label>

                        <div className="cr-field cr-price-field">
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                                <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                            </svg>
                            <div className="cr-slider-wrap">
                                <div className="cr-slider-head">
                                    <span>Price Range</span>
                                    <strong className="cr-slider-value">
                                        {priceScale.displayMin} – {priceScale.displayMax}
                                        <em>/day</em>
                                    </strong>
                                </div>
                                <div className="cr-dual-range">
                                    <input
                                        type="range"
                                        min="50"
                                        max="500"
                                        step="10"
                                        value={priceMin}
                                        aria-label={`Minimum price ${priceScale.displayMin}`}
                                        onChange={(e) => setPriceMin(Math.min(Number(e.target.value), priceMax - 10))}
                                    />
                                    <input
                                        type="range"
                                        min="50"
                                        max="500"
                                        step="10"
                                        value={priceMax}
                                        aria-label={`Maximum price ${priceScale.displayMax}`}
                                        onChange={(e) => setPriceMax(Math.max(Number(e.target.value), priceMin + 10))}
                                    />
                                    <div className="cr-range-track">
                                        <div
                                            className="cr-range-fill"
                                            style={{
                                                left: `${((priceMin - 50) / 450) * 100}%`,
                                                width: `${((priceMax - priceMin) / 450) * 100}%`,
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className="cr-slider-ends">
                                    <span>{priceScale.floor}</span>
                                    <span>{priceScale.ceil}</span>
                                </div>
                            </div>
                        </div>

                        <button type="submit" className="cr-search-btn">
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                                <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                            Search
                        </button>
                    </form>
                </div>
            </section>

            <section className="container cr-section">
                <h2 className="cr-section-title">Explore by Vehicle Type</h2>
                <div className="cr-categories">
                    {CATEGORIES.map((cat) => (
                        <button
                            key={cat.id}
                            type="button"
                            className={`cr-cat ${cat.accent} ${category === cat.id ? 'active' : ''}`}
                            onClick={() => setCategory((c) => (c === cat.id ? '' : cat.id))}
                        >
                            <span className="cr-cat-icon"><CategoryIcon type={cat.icon} /></span>
                            <span className="cr-cat-label">{cat.label}</span>
                            <img src={cat.thumb} alt="" className="cr-cat-thumb" />
                        </button>
                    ))}
                </div>
            </section>

            <section className="container cr-section cr-available">
                <div className="cr-available-head">
                    <h2 className="cr-section-title">Available Cars</h2>
                    <div className="cr-sorts" role="group" aria-label="Sort filters">
                        <button
                            type="button"
                            className={sortBy.startsWith('price') ? 'active' : ''}
                            onClick={() => setSortBy((s) => (s === 'price' ? 'price-desc' : 'price'))}
                        >
                            Price
                        </button>
                        <button type="button" className="muted" disabled>Distance</button>
                        <button type="button" className="muted" disabled>Rating</button>
                    </div>
                </div>

                {loadError && <p className="cr-demo-note">{loadError}</p>}

                {loading ? (
                    <div className="cr-grid">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="cr-card cr-skeleton" />
                        ))}
                    </div>
                ) : listings.length === 0 ? (
                    <div className="cr-empty">
                        <h3>No cars listed yet</h3>
                        <p>Be the first host in this city, or widen your search dates.</p>
                        <Link to="/host" className="cr-book">List your car</Link>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="cr-empty">
                        <h3>No cars match these filters</h3>
                        <p>Clear the category or widen the price range.</p>
                        <button type="button" className="cr-book" onClick={() => { setCategory(''); setPriceMin(50); setPriceMax(500); }}>
                            Reset filters
                        </button>
                    </div>
                ) : (
                    <div className="cr-grid">
                        {filtered.map((listing, index) => {
                            const v = listing.vehicle;
                            const image = v.images?.[0] || FALLBACK_IMAGES[index % FALLBACK_IMAGES.length];
                            const glow = index % 3 === 0 ? 'glow-teal' : 'glow-orange';
                            const title = `${v.make} ${v.model}`.toUpperCase();
                            return (
                                <article key={listing.id} className={`cr-card ${glow}`}>
                                    <div className="cr-card-media">
                                        <img src={image} alt={title} loading="lazy" />
                                    </div>
                                    <div className="cr-card-body">
                                        <h3>{title}</h3>
                                        <div className="cr-specs">
                                            <span>{v.transmission || 'Automatic'}</span>
                                            <span>{v.seats || 4} Seats</span>
                                            <span>{v.fuelType || 'Petrol'}</span>
                                        </div>
                                        <div className="cr-host-row">
                                            {listing.host?.avatarUrl
                                                ? <img src={listing.host.avatarUrl} alt={listing.host.name} className="cr-avatar" />
                                                : <div className="cr-avatar fallback">{listing.host?.name?.[0] || '?'}</div>
                                            }
                                            <span>{listing.host?.name || 'Host'}</span>
                                            <strong className="cr-price">₹{Number(listing.pricePerDay).toLocaleString()}/day</strong>
                                        </div>
                                        <div className="cr-actions">
                                            <button type="button" className="cr-book" onClick={() => handleBook(listing)}>
                                                Book Now
                                            </button>
                                            <Link to={`/profile/${listing.host?.id}`} className="cr-host-btn">
                                                Host Profile
                                            </Link>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </section>

            <div className="container cr-host-cta">
                <Link to="/host">Become a Host</Link>
            </div>

            <TermsAcceptanceModal
                isOpen={termsOpen}
                policyType="RENTAL_TERMS"
                onAccept={handleTermsAccept}
                onClose={() => { setTermsOpen(false); setPendingListing(null); }}
                loading={termsLoading}
            />
        </div>
    );
}
