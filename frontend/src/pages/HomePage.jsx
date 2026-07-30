import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';
import { useAuthUiStore } from '../store/authUiStore.js';
import './HomePage.css';

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
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
                <path d="M12 3v18M8 7.5c0-1.5 1.6-2.5 4-2.5s4 1 4 2.5-1.6 2.5-4 2.5-4 1-4 2.5 1.6 2.5 4 2.5 4-1 4-2.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
        ),
    },
];

const MODULES = {
    trips: {
        to: '/trips',
        title: 'Group Adventure Hub',
        cta: 'Browse trips →',
        // Friends on the road — no yellow van
        image: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1400&q=80',
    },
    rentals: {
        to: '/rentals',
        title: 'Select from the Best Community Cars',
        cta: 'Find a car →',
        // Clean SUV for rentals
        image: 'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=1400&q=80',
    },
};

export default function HomePage() {
    const user = useAuthStore((s) => s.user);
    const logout = useAuthStore((s) => s.logout);
    const openAuth = useAuthUiStore((s) => s.openAuth);
    const [mode, setMode] = useState('trips');

    const handleLogout = async () => {
        await logout();
    };

    return (
        <div className="home page-enter">
            <section className="home-welcome">
                <div className="container home-welcome-inner">
                    <div className="home-welcome-copy">
                        <p className="home-welcome-kicker">PackAndSync</p>
                        <h1 className="font-display">Travel together. Rent when you need wheels.</h1>
                        <p>
                            Join group trips, split costs, and book community cars — all in one place.
                        </p>
                    </div>
                    <div className="home-welcome-actions">
                        {user ? (
                            <>
                                <Link to="/trips" className="home-btn primary">Browse trips</Link>
                                <Link to="/bookings" className="home-btn soft">My bookings</Link>
                                <button type="button" className="home-btn ghost" onClick={handleLogout}>
                                    Sync Out
                                </button>
                            </>
                        ) : (
                            <button type="button" className="home-btn primary home-btn-sync" onClick={() => openAuth('login')}>
                                Sync In
                            </button>
                        )}
                    </div>
                </div>
            </section>

            <section className="home-modules">
                <div className="container">
                    <div className="home-mode-switch" role="tablist" aria-label="Choose experience">
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
                            Car on Rent
                        </button>
                    </div>

                    <div className="home-card-grid">
                        {Object.entries(MODULES).map(([key, mod]) => (
                            <Link
                                key={key}
                                to={mod.to}
                                className={`home-mod-card ${mode === key ? 'focused' : ''}`}
                                style={{ '--mod-image': `url('${mod.image}')` }}
                            >
                                <span className="home-mod-media" aria-hidden="true" />
                                <span className="home-mod-shade" aria-hidden="true" />
                                <span className="home-mod-content">
                                    <h2 className="font-display">{mod.title}</h2>
                                    <span className="home-mod-cta">{mod.cta}</span>
                                </span>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            <section className="home-steps">
                <div className="container">
                    <h2 className="font-display home-steps-title">How Travel Together works</h2>
                    <p className="home-steps-sub">Built for group trips — not ride price comparison.</p>
                    <ol className="home-steps-row">
                        {STEPS.map((s) => (
                            <li key={s.n} className="home-step">
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
                    <div className="home-cta-panel">
                        <div className="home-cta-glow" aria-hidden="true" />
                        <div className="home-cta-copy">
                            <p className="home-cta-kicker">Next up</p>
                            <h2 className="font-display">Ready for the next trip?</h2>
                            <p>
                                Post a route, invite travelers, and split costs clearly — or list your car and earn when someone needs wheels.
                            </p>
                        </div>
                        <div className="home-cta-actions">
                            {user ? (
                                <>
                                    <Link to="/trips/create" className="home-btn primary">Post a Trip</Link>
                                    <Link to="/rentals" className="home-btn soft">Browse cars</Link>
                                    <button type="button" className="home-btn ghost" onClick={handleLogout}>
                                        Sync Out
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button type="button" className="home-btn primary home-btn-sync" onClick={() => openAuth('login')}>
                                        Sync In
                                    </button>
                                    <Link to="/rentals" className="home-btn ghost">Browse cars</Link>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
