import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';
import useGoFlyMotion from '../hooks/useGoFlyMotion.js';
import { STOCK } from '../constants/stockImages.js';
import { HERO_MEDIA } from '../utils/heroMedia.js';
import AnimatedLogo from '../components/AnimatedLogo';
import './HomePage.css';

const SEARCH_TABS = [
    { id: 'trips', label: 'Trips', iconTone: 'gold' },
    { id: 'cars', label: 'Cars', iconTone: 'brown' },
    { id: 'bikes', label: 'Bikes', iconTone: 'blue' },
    { id: 'explore', label: 'Explore', iconTone: 'green' },
];

const CATEGORIES = {
    trips: [
        { value: '', label: 'Any trip' },
        { value: 'OPEN', label: 'Open to join' },
        { value: 'weekend', label: 'Weekend getaway' },
        { value: 'group', label: 'Group adventure' },
    ],
    cars: [
        { value: '', label: 'Any car' },
        { value: 'suv', label: 'SUVs' },
        { value: 'luxury', label: 'Luxury Sedans' },
        { value: 'electric', label: 'Electric' },
    ],
    bikes: [
        { value: '', label: 'Any bike' },
        { value: 'scooter', label: 'Scooter' },
        { value: 'sports', label: 'Sport' },
        { value: 'commuter', label: 'Commuter' },
    ],
    explore: [
        { value: '', label: 'Places & plans' },
        { value: 'food', label: 'Food & stays' },
        { value: 'sights', label: 'Sightseeing' },
    ],
};

const STEPS = [
    {
        n: '01',
        title: 'Post a trip',
        desc: 'Share where you’re going and when. Your route becomes a joinable trip.',
        icon: (
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
                <path d="M8 10h8M8 14h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                <path d="M5 6.5h14a1.5 1.5 0 011.5 1.5v8a1.5 1.5 0 01-1.5 1.5H9l-4 3v-3H5A1.5 1.5 0 013.5 16V8A1.5 1.5 0 015 6.5z" stroke="currentColor" strokeWidth="1.7" />
            </svg>
        ),
    },
    {
        n: '02',
        title: 'Others join',
        desc: 'Travelers request to join. You approve who comes along.',
        icon: (
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
                <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.7" />
                <circle cx="16.5" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.7" />
                <path d="M3.5 18c.9-2.8 3-4.2 5.5-4.2s4.6 1.4 5.5 4.2M14.5 14.5c1.8.3 3.2 1.3 4 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
        ),
    },
    {
        n: '03',
        title: 'Split the money',
        desc: 'Add fuel, stay, or food costs and split fairly across the group.',
        icon: (
            <span className="home-step-rupee" aria-hidden="true">₹</span>
        ),
    },
];

const MODULES = {
    trips: {
        to: '/trips',
        title: 'Group Adventure Hub',
        cta: 'Browse trips →',
        image: STOCK.tripRoad,
    },
    rentals: {
        to: '/rentals',
        title: 'Community cars & bikes',
        cta: 'Find wheels →',
        image: STOCK.carClassic,
    },
};

function TabIcon({ tone }) {
    if (tone === 'gold') {
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M7 8h10l1.2 12H5.8L7 8z" stroke="#f5b800" strokeWidth="1.7" strokeLinejoin="round" />
                <path d="M9 8V6.5A3 3 0 0112 3.5a3 3 0 013 3V8" stroke="#f5b800" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
        );
    }
    if (tone === 'brown') {
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 11h16l-1.2 7.5a2 2 0 01-2 1.7H7.2a2 2 0 01-2-1.7L4 11z" stroke="#a16207" strokeWidth="1.7" />
                <path d="M7 11V8.5A2.5 2.5 0 019.5 6h5A2.5 2.5 0 0117 8.5V11" stroke="#a16207" strokeWidth="1.7" />
            </svg>
        );
    }
    if (tone === 'blue') {
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 14l2-5h10l2 5" stroke="#007bff" strokeWidth="1.7" strokeLinejoin="round" />
                <circle cx="8" cy="16.5" r="1.8" stroke="#007bff" strokeWidth="1.7" />
                <circle cx="16" cy="16.5" r="1.8" stroke="#007bff" strokeWidth="1.7" />
                <path d="M4 14h16" stroke="#007bff" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
        );
    }
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="8" stroke="#16a34a" strokeWidth="1.7" />
            <path d="M8.5 12.2l2.2 2.2 4.8-5" stroke="#16a34a" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export default function HomePage() {
    const user = useAuthStore((s) => s.user);
    const logout = useAuthStore((s) => s.logout);
    const navigate = useNavigate();
    const [mode, setMode] = useState('trips');
    const [searchTab, setSearchTab] = useState('trips');
    const [location, setLocation] = useState('');
    const [date, setDate] = useState('');
    const [category, setCategory] = useState('');
    const [reduceMotion, setReduceMotion] = useState(false);
    const [loadHeroVideo, setLoadHeroVideo] = useState(false);
    const motionRef = useRef(null);
    const videoRef = useRef(null);
    useGoFlyMotion(motionRef, [mode, searchTab]);

    useEffect(() => {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        const sync = () => setReduceMotion(mq.matches);
        sync();
        mq.addEventListener('change', sync);
        return () => mq.removeEventListener('change', sync);
    }, []);

    useEffect(() => {
        if (reduceMotion) return undefined;
        const idle = window.requestIdleCallback || ((cb) => window.setTimeout(cb, 200));
        const cancel = window.cancelIdleCallback || window.clearTimeout;
        const id = idle(() => setLoadHeroVideo(true));
        return () => cancel(id);
    }, [reduceMotion]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        if (reduceMotion) {
            video.pause();
            return;
        }

        video.playbackRate = 0.78;
        const play = () => {
            video.playbackRate = 0.78;
            video.play().catch(() => {});
        };
        play();
        video.addEventListener('loadeddata', play);
        return () => video.removeEventListener('loadeddata', play);
    }, [reduceMotion, loadHeroVideo]);

    useEffect(() => {
        setCategory('');
    }, [searchTab]);

    const handleLogout = async () => {
        await logout();
    };

    const handleSearch = (e) => {
        e.preventDefault();
        const loc = location.trim();
        const params = new URLSearchParams();

        if (searchTab === 'trips') {
            if (loc) params.set('q', loc);
            if (category && ['OPEN', 'DRAFT', 'FULL'].includes(category)) params.set('status', category);
            navigate(`/trips${params.toString() ? `?${params}` : ''}`);
            return;
        }
        if (searchTab === 'cars' || searchTab === 'bikes') {
            if (searchTab === 'bikes') params.set('kind', 'bike');
            if (loc) params.set('location', loc);
            if (date) params.set('startDate', date);
            if (category) params.set('category', category);
            navigate(`/rentals?${params.toString()}`);
            return;
        }
        if (loc) params.set('q', loc);
        navigate(`/explore${params.toString() ? `?${params}` : ''}`);
    };

    return (
        <div className="home page-atmosphere page-enter" ref={motionRef}>
            <section className={`home-hero ${reduceMotion ? 'home-hero--static' : ''}`}>
                {!reduceMotion && HERO_MEDIA && (
                    <video
                        ref={videoRef}
                        className="home-hero-video"
                        poster={HERO_MEDIA.poster}
                        autoPlay
                        muted
                        loop
                        playsInline
                        preload="none"
                        aria-hidden="true"
                        tabIndex={-1}
                    >
                        {loadHeroVideo && (
                            <source src={HERO_MEDIA.video} type="video/mp4" />
                        )}
                    </video>
                )}
                <div className="home-hero-overlay" aria-hidden="true" />

                <div className="container home-hero-copy ps-reveal">
                    <div className="hero-logo"><AnimatedLogo size={120} /></div>
                    <p className="home-hero-brand">PickAndSync</p>
                    <h1>Travel together. Book wheels. Split fairly.</h1>
                    <p className="home-hero-sub">
                        Join group trips, rent community cars or bikes, and keep every cost clear — built for crews on the move.
                    </p>
                </div>

                <div className="container home-search-wrap ps-reveal ps-scale">
                    <form className="home-search-card" onSubmit={handleSearch}>
                        <div className="home-search-tabs" role="tablist" aria-label="Search type">
                            {SEARCH_TABS.map((tab) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={searchTab === tab.id}
                                    className={`home-search-tab ${searchTab === tab.id ? 'active' : ''}`}
                                    onClick={() => setSearchTab(tab.id)}
                                >
                                    <TabIcon tone={tab.iconTone} />
                                    <span>{tab.label}</span>
                                </button>
                            ))}
                        </div>

                        <div className="home-search-fields">
                            <label className="home-search-field">
                                <span className="home-search-icon" aria-hidden="true">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                        <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="1.8" />
                                        <path d="M12 21s-7-6.2-7-11a7 7 0 1114 0c0 4.8-7 11-7 11z" stroke="currentColor" strokeWidth="1.8" />
                                    </svg>
                                </span>
                                <span className="home-search-label">Location</span>
                                <input
                                    type="text"
                                    placeholder="Where are you headed?"
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    autoComplete="off"
                                />
                            </label>

                            <label className="home-search-field">
                                <span className="home-search-icon" aria-hidden="true">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                        <rect x="3.5" y="5" width="17" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
                                        <path d="M8 3.5v3M16 3.5v3M3.5 10h17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                                    </svg>
                                </span>
                                <span className="home-search-label">Date</span>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                />
                            </label>

                            <label className="home-search-field">
                                <span className="home-search-icon" aria-hidden="true">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                        <path d="M5 7h14M5 12h10M5 17h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                                    </svg>
                                </span>
                                <span className="home-search-label">Category</span>
                                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                                    {(CATEGORIES[searchTab] || CATEGORIES.trips).map((opt) => (
                                        <option key={opt.value || 'any'} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </label>

                            <button type="submit" className="home-search-submit">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                                    <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                                SEARCH
                            </button>
                        </div>

                        <p className="home-search-foot">
                            Can&apos;t find what you&apos;re looking for?{' '}
                            <Link to="/trips/create">create your Custom Trip</Link>
                        </p>
                    </form>
                </div>
            </section>

            <section className="home-modules">
                <div className="container">
                    <div className="home-mode-switch ps-reveal" role="tablist" aria-label="Choose experience">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={mode === 'trips'}
                            className={mode === 'trips' ? 'active' : ''}
                            onClick={() => setMode('trips')}
                        >
                            Travel Together
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={mode === 'rentals'}
                            className={mode === 'rentals' ? 'active' : ''}
                            onClick={() => setMode('rentals')}
                        >
                            Cars & Bikes
                        </button>
                    </div>

                    <div className="home-card-grid">
                        {Object.entries(MODULES).map(([key, mod]) => (
                            <Link
                                key={key}
                                to={mod.to}
                                className={`home-mod-card ps-reveal ps-image-reveal ps-lift ${mode === key ? 'focused' : ''}`}
                                style={{
                                    '--mod-image': `url('${mod.image}')`,
                                    '--ps-delay': `${key === 'rentals' ? 140 : 0}ms`,
                                }}
                            >
                                <span className="home-mod-media" aria-hidden="true" />
                                <span className="home-mod-shade" aria-hidden="true" />
                                <span className="home-mod-content">
                                    <h2>{mod.title}</h2>
                                    <span className="home-mod-cta">{mod.cta}</span>
                                </span>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            <section className="home-steps">
                <div className="container">
                    <h2 className="home-steps-title">How Travel Together works</h2>
                    <p className="home-steps-sub ps-reveal">Built for group trips — not ride price comparison.</p>
                    <ol className="home-steps-row">
                        {STEPS.map((s) => (
                            <li key={s.n} className="home-step ps-reveal ps-lift" style={{ '--ps-delay': `${Number(s.n) * 90}ms` }}>
                                <span className="home-step-n" aria-hidden="true">{s.n}</span>
                                <div className="home-step-icon">{s.icon}</div>
                                <h3>{s.title}</h3>
                                <p>{s.desc}</p>
                            </li>
                        ))}
                    </ol>
                </div>
            </section>

            <section className="home-cta">
                <div className="container">
                    <div className="home-cta-panel ps-reveal ps-scale">
                        <div className="home-cta-glow" aria-hidden="true" />
                        <div className="home-cta-copy">
                            <p className="home-cta-kicker">Next up</p>
                            <h2>Ready for the next trip?</h2>
                            <p>
                                Post a route, invite travelers, and split costs clearly — or list your car or bike and earn when someone needs wheels.
                            </p>
                        </div>
                        <div className="home-cta-actions">
                            {user ? (
                                <>
                                    <Link to="/trips/create" className="home-btn primary">Post a Trip</Link>
                                    <Link to="/rentals" className="home-btn soft">Browse cars</Link>
                                    <Link to="/rentals?kind=bike" className="home-btn ghost">Browse bikes</Link>
                                    <button type="button" className="home-btn ghost" onClick={handleLogout}>
                                        Sync Out
                                    </button>
                                </>
                            ) : (
                                <>
                                    <Link to="/trips" className="home-btn primary">Browse trips</Link>
                                    <Link to="/rentals" className="home-btn soft">Browse cars</Link>
                                    <Link to="/rentals?kind=bike" className="home-btn ghost">Browse bikes</Link>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
