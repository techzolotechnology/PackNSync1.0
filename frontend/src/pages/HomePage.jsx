import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';
import useGoFlyMotion from '../hooks/useGoFlyMotion.js';
import { STOCK } from '../constants/stockImages.js';
import { HERO_MEDIA } from '../utils/heroMedia.js';
import AnimatedLogo from '../components/AnimatedLogo';
import { pricingApi } from '../api/index.js';
import { trackWebsiteEvent } from '../utils/websiteGrowth.js';
import './HomePage.css';

const SEARCH_TABS = [
    { id: 'trips', label: 'Trips', colors: ['#fff08c', '#f69a22', '#c75315'] },
    { id: 'cars', label: 'Cars', colors: ['#ffada5', '#fa5d58', '#bb223f'] },
    { id: 'bikes', label: 'Bikes', colors: ['#86e9ff', '#2e98fa', '#2246c0'] },
    { id: 'explore', label: 'Explore', colors: ['#a4f4d4', '#24bf9d', '#08756b'] },
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
        { value: 'cng', label: 'CNG Cars' },
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

function TabIcon({ tab, colors: [light, mid, dark] }) {
    const gradientId = useId();
    const face = `url(#${gradientId})`;

    return (
        <svg className="home-search-tab-icon" viewBox="0 0 32 32" width="30" height="30" fill="none" aria-hidden="true">
            <defs>
                <linearGradient id={gradientId} x1="15%" y1="0%" x2="88%" y2="100%">
                    <stop stopColor={light} />
                    <stop offset=".62" stopColor={mid} />
                    <stop offset="1" stopColor={dark} />
                </linearGradient>
            </defs>
            <ellipse cx="16" cy="28.5" rx="12" ry="1.8" fill={dark} opacity=".18" />
            {tab === 'trips' && (
                <>
                    <path d="M12 9V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v3" stroke={dark} strokeWidth="2.3" />
                    <path d="M18 8h4a5 5 0 0 1 5 5v10a4 4 0 0 1-4 4h-5Z" fill={dark} />
                    <rect x="5" y="8" width="18" height="19" rx="4.5" fill={face} />
                    <path d="M10 11v13m8-13v13" stroke="#fff7c4" strokeWidth="1.4" strokeLinecap="round" opacity=".72" />
                    <path d="m13 15 4-1.2 1.2 4-4 1.2z" fill="#fff6df" />
                    <path d="M9 27h3m8 0h3" stroke="#663312" strokeWidth="2" strokeLinecap="round" />
                </>
            )}
            {tab === 'cars' && (
                <>
                    <rect x="4" y="19" width="5" height="8" rx="2" fill="#24334f" />
                    <rect x="23" y="19" width="5" height="8" rx="2" fill="#24334f" />
                    <path d="m6 14 2.4-6a3.5 3.5 0 0 1 3.2-2.2h8.8A3.5 3.5 0 0 1 23.6 8l2.4 6Z" fill={face} />
                    <path d="m9.1 13 1.6-4a1.5 1.5 0 0 1 1.4-.9h7.8a1.5 1.5 0 0 1 1.4.9l1.6 4Z" fill="#24476b" />
                    <path d="m11 10-.95 2.1h6.45l2.05-3h-6.25A1.45 1.45 0 0 0 11 10Z" fill="#8adffc" opacity=".74" />
                    <rect x="3" y="13" width="26" height="11.5" rx="4" fill={face} />
                    <path d="M7.5 17.5h3.2m10.6 0h3.2" stroke="#fff5d8" strokeWidth="2.5" strokeLinecap="round" />
                    <path d="M13 21.5h6" stroke="#7a2039" strokeWidth="1.6" strokeLinecap="round" />
                </>
            )}
            {tab === 'bikes' && (
                <>
                    <circle cx="7.4" cy="22.6" r="5" fill="#223651" />
                    <circle cx="24.9" cy="22.6" r="5" fill="#223651" />
                    <circle cx="7.4" cy="22.6" r="2" fill="#b9def4" />
                    <circle cx="24.9" cy="22.6" r="2" fill="#b9def4" />
                    <path d="m25 22.6-5-15h-4" stroke="#28446a" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M4 19a5 5 0 0 1 5-5h5l3.1 5h3l-1.5-7.2h3.2l3 7.3-3.7 4.9H10.4L7 19Z" fill={face} />
                    <path d="M7 13.4h7.6" stroke="#273557" strokeWidth="2.7" strokeLinecap="round" />
                    <path d="M20.5 11.6h2" stroke="#fff1b2" strokeWidth="2.1" strokeLinecap="round" />
                </>
            )}
            {tab === 'explore' && (
                <>
                    <circle cx="17" cy="17" r="11.2" fill={dark} />
                    <circle cx="15.6" cy="15.3" r="11.2" fill={face} />
                    <circle cx="15.6" cy="15.3" r="8" fill="#e6fff4" />
                    <path d="M15.6 8.6v1.3m0 10.8V22M8.9 15.3h1.3m10.8 0h1.3" stroke={dark} strokeWidth="1.1" strokeLinecap="round" />
                    <path d="m20.9 10-3.5 7-3.5-3.5Z" fill="#fc7456" />
                    <path d="m10.3 20.6 3.6-7.1 3.5 3.5Z" fill="#16618e" />
                    <circle cx="15.6" cy="15.3" r="1" fill="#fff" />
                </>
            )}
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
    const [premiumBannerPrice, setPremiumBannerPrice] = useState(null);
    const motionRef = useRef(null);
    const videoRef = useRef(null);
    useGoFlyMotion(motionRef, [mode, searchTab]);

    useEffect(() => {
        let active = true;
        pricingApi.getPremiumBanner().then((res) => {
            if (active) setPremiumBannerPrice(res.data.data.price);
        }).catch(() => {});
        return () => { active = false; };
    }, []);

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
                    <h1>Plan group trips with friends.</h1>
                    <p className="home-hero-sub">
                        Share an itinerary, coordinate your group, split trip costs, and find self-drive cars, bikes or scooters on PickAndSync.
                    </p>
                    <div className="home-hero-actions">
                        <Link to="/trips/create" className="home-btn primary" onClick={() => trackWebsiteEvent('planner_opened')}>
                            Plan a group trip
                        </Link>
                        <Link to="/tools/trip-cost-splitter/" className="home-btn soft" onClick={() => trackWebsiteEvent('splitter_opened')}>
                            Split trip costs
                        </Link>
                    </div>
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
                                    <TabIcon tab={tab.id} colors={tab.colors} />
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

            {premiumBannerPrice !== null && (
                <section className="home-premium-banner" aria-label="Premium banner placement pricing">
                    <div className="container">
                        <div className="home-premium-banner-inner">
                            <div className="home-premium-copy">
                                <p className="home-premium-kicker">
                                    <span className="home-premium-spark" aria-hidden="true">✦</span>
                                    Premium placement
                                </p>
                                <h2>Make your travel offer the one everyone notices.</h2>
                                <p className="home-premium-description">
                                    Put your trip, rental, or travel service in front of people planning their next journey.
                                </p>
                                <div className="home-premium-benefits" aria-label="Premium benefits">
                                    <span>More visibility</span>
                                    <span>Cancel anytime</span>
                                </div>
                            </div>
                            <div className="home-premium-price">
                                <span className="home-premium-price-label">30-DAY INTRO OFFER</span>
                                <div className="home-premium-trial">
                                    <strong>₹5</strong>
                                    <span>for your<br />first 30 days</span>
                                </div>
                                <p className="home-premium-standard">
                                    Then <strong>₹{Number(premiumBannerPrice).toLocaleString('en-IN')}</strong>
                                    <span> / banner / month</span>
                                </p>
                                <Link className="home-premium-cta" to="/premium">
                                    Explore Premium <span aria-hidden="true">→</span>
                                </Link>
                                <small className="home-premium-renewal">Auto-renews monthly after trial. Cancel anytime.</small>
                            </div>
                        </div>
                    </div>
                </section>
            )}

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
