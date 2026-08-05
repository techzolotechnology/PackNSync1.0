import { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { tripsApi } from '../api/index.js';
import { useAuthStore } from '../store/authStore.js';
import { format } from 'date-fns';
import useGoFlyMotion from '../hooks/useGoFlyMotion.js';
import { TRIP_COVER_FALLBACKS, STOCK_IMG_SIZE } from '../constants/stockImages.js';
import './TripsPage.css';

const STATUSES = ['', 'OPEN', 'FULL', 'IN_PROGRESS', 'COMPLETED'];
const STATUS_LABELS = {
    OPEN: 'Open',
    FULL: 'Filling',
    IN_PROGRESS: 'Ongoing',
    COMPLETED: 'Closed',
    DRAFT: 'Draft',
    CANCELLED: 'Cancelled',
};

const COVER_FALLBACKS = TRIP_COVER_FALLBACKS;

const coverFor = (trip, index) =>
    trip.coverImageUrl || COVER_FALLBACKS[index % COVER_FALLBACKS.length];

function Avatar({ user, className = '' }) {
    if (user?.avatarUrl) {
        return <img src={user.avatarUrl} alt={user.name || ''} className={`tt-avatar ${className}`} />;
    }
    return (
        <div className={`tt-avatar tt-avatar-fallback ${className}`} aria-hidden="true">
            {(user?.name || '?')[0]}
        </div>
    );
}

function TripCard({ trip, index, isMine, myRole }) {
    const startDate = trip.startDate ? format(new Date(trip.startDate), 'MMM d') : '';
    const endDate = trip.endDate ? format(new Date(trip.endDate), 'MMM d, yyyy') : '';
    const statusKey = (trip.status || 'OPEN').toLowerCase();
    const statusLabel = STATUS_LABELS[trip.status] || trip.status;
    const members = trip.members || [];
    const glow = index % 3 === 0 ? 'glow-teal' : 'glow-orange';
    const role = myRole || (isMine ? 'ORGANIZER' : null);

    return (
        <article className={`tt-card ${glow} ps-reveal ps-image-reveal ps-lift`} style={{ '--ps-delay': `${(index % 4) * 90}ms` }}>
            <div className="tt-card-media">
                <img
                    src={coverFor(trip, index)}
                    alt={trip.title}
                    loading="lazy"
                    width={STOCK_IMG_SIZE.cardCover.width}
                    height={STOCK_IMG_SIZE.cardCover.height}
                />
                <span className={`tt-status tt-status-${statusKey}`}>{statusLabel}</span>
                {role === 'ORGANIZER' && <span className="tt-yours-badge">Yours</span>}
                {role === 'MEMBER' && <span className="tt-yours-badge tt-joined-badge">Joined</span>}
            </div>
            <div className="tt-card-body">
                <h3 className="tt-card-title">{trip.title}</h3>
                <p className="tt-card-dates">
                    {startDate && endDate ? `${startDate} – ${endDate}` : trip.destination}
                </p>
                <div className="tt-card-host">
                    <Avatar user={trip.organizer} />
                    <span>{trip.organizer?.name || 'Host'}</span>
                </div>
                <div className="tt-card-footer">
                    <div className="tt-avatars" aria-label={`${trip._count?.members || members.length} travelers`}>
                        {members.slice(0, 4).map((m) => (
                            <Avatar key={m.userId || m.user?.id} user={m.user} />
                        ))}
                        {(trip._count?.members || 0) > 4 && (
                            <span className="tt-avatar tt-avatar-more">+{(trip._count.members) - 4}</span>
                        )}
                    </div>
                    <Link to={`/trips/${trip.id}`} className="tt-view-btn">View Details</Link>
                </div>
            </div>
        </article>
    );
}

export default function TripsPage() {
    const user = useAuthStore((s) => s.user);
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const tab = searchParams.get('tab') === 'mine' ? 'mine' : 'all';

    const [trips, setTrips] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState(() => searchParams.get('q') || '');
    const [status, setStatus] = useState(() => searchParams.get('status') || '');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState(null);
    const motionRef = useRef(null);
    useGoFlyMotion(motionRef, [trips, isLoading, tab]);

    const setTab = (next) => {
        if (next === 'mine') {
            if (!user) {
                navigate('/login');
                return;
            }
            setSearchParams({ tab: 'mine' });
        } else {
            setSearchParams({});
        }
        setPage(1);
    };

    const fetchTrips = useCallback(async () => {
        if (tab === 'mine' && !user) {
            setTrips([]);
            setPagination(null);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const params = { search, status, page, limit: 12 };
            const res = tab === 'mine'
                ? await tripsApi.getMine(params)
                : await tripsApi.getAll(params);
            setTrips(res.data.data);
            setPagination(res.data.pagination);
        } catch (err) {
            console.error(err);
            setTrips([]);
        } finally {
            setIsLoading(false);
        }
    }, [search, status, page, tab, user]);

    useEffect(() => { fetchTrips(); }, [fetchTrips]);

    useEffect(() => {
        if (tab === 'mine' && !user) navigate('/login');
    }, [tab, user, navigate]);

    return (
        <div className="tt-page page-atmosphere page-enter" ref={motionRef}>
            <section className="tt-hero">
                <div className="tt-hero-bg ps-parallax" aria-hidden="true">
                    <svg className="tt-waves" viewBox="0 0 1440 420" preserveAspectRatio="none">
                        <path className="tt-wave tt-wave-1" d="M-40,260 C180,120 360,340 540,210 C720,80 900,300 1080,190 C1260,80 1380,240 1520,160" />
                        <path className="tt-wave tt-wave-2" d="M-40,300 C200,160 380,360 560,240 C740,120 920,320 1100,220 C1280,120 1400,280 1520,200" />
                        <path className="tt-wave tt-wave-3" d="M-40,220 C160,100 340,280 520,170 C700,60 880,250 1060,150 C1240,50 1360,210 1520,130" />
                        <path className="tt-wave tt-wave-4" d="M-40,340 C220,220 400,380 580,280 C760,180 940,360 1120,270 C1300,180 1420,320 1520,250" />
                    </svg>
                    <div className="tt-bokeh">
                        <span /><span /><span /><span /><span /><span /><span /><span />
                        <span /><span /><span /><span /><span /><span /><span /><span />
                    </div>
                </div>
                <div className="container tt-hero-inner">
                    <div className="tt-hero-copy ps-reveal ps-left">
                        <h1>{tab === 'mine' ? 'My trips' : 'Travel Together'}</h1>
                        <p>
                            {tab === 'mine'
                                ? 'Trips you organize or have joined — open one to chat, split costs, and plan.'
                                : 'Browse trips others posted — join them and split the money with the group.'}
                        </p>
                    </div>
                    <Link to="/trips/create" className="tt-post-btn ps-reveal ps-right">
                        <span className="tt-post-plus">+</span>
                        Post a Trip
                    </Link>
                </div>
            </section>

            <div className="container tt-main">
                <div className="tt-tabs ps-reveal">
                    <button
                        type="button"
                        className={tab === 'all' ? 'active' : ''}
                        onClick={() => setTab('all')}
                    >
                        Discover
                    </button>
                    {user && (
                        <button
                            type="button"
                            className={tab === 'mine' ? 'active' : ''}
                            onClick={() => setTab('mine')}
                        >
                            My trips
                        </button>
                    )}
                </div>

                <div className="tt-toolbar ps-reveal">
                    <label className="tt-search">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                            <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        <input
                            type="search"
                            placeholder="Search destinations, trip names..."
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        />
                    </label>
                    <label className="tt-filter">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                            <option value="">All Statuses</option>
                            {(tab === 'mine'
                                ? ['OPEN', 'DRAFT', 'FULL', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']
                                : STATUSES.filter(Boolean)
                            ).map((s) => (
                                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                            ))}
                        </select>
                    </label>
                </div>

                {isLoading ? (
                    <div className="tt-grid">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="tt-card tt-skeleton">
                                <div className="skeleton" style={{ aspectRatio: '16/10' }} />
                                <div style={{ padding: '1rem', display: 'grid', gap: '0.6rem' }}>
                                    <div className="skeleton" style={{ height: 18, width: '80%' }} />
                                    <div className="skeleton" style={{ height: 12, width: '50%' }} />
                                    <div className="skeleton" style={{ height: 28, width: '40%' }} />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : trips.length === 0 ? (
                    <div className="tt-empty">
                        <h3>{tab === 'mine' ? 'No trips yet' : 'No trips found'}</h3>
                        <p>
                            {tab === 'mine'
                                ? 'Join a trip from Discover, or post your own and invite others.'
                                : 'Try another search or be the first to post.'}
                        </p>
                        <Link to="/trips/create" className="tt-post-btn">+ Post a Trip</Link>
                    </div>
                ) : (
                    <div className="tt-grid">
                        {trips.map((trip, index) => (
                            <TripCard
                                key={trip.id}
                                trip={trip}
                                index={index}
                                isMine={Boolean(user && trip.organizerId === user.id)}
                                myRole={trip.myRole || (user && trip.organizerId === user.id ? 'ORGANIZER' : null)}
                            />
                        ))}
                    </div>
                )}

                {pagination && pagination.pages > 1 && (
                    <div className="tt-pagination">
                        <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
                        <span>{page} / {pagination.pages}</span>
                        <button type="button" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}>Next</button>
                    </div>
                )}
            </div>
        </div>
    );
}
