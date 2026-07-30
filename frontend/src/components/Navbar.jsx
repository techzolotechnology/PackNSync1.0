import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../store/authStore.js';
import { useAuthUiStore } from '../store/authUiStore.js';
import { notificationsApi } from '../api/index.js';
import { useChatUnreadStore } from '../store/chatUnreadStore.js';
import toast from 'react-hot-toast';
import './Navbar.css';

function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}

export default function Navbar() {
    const { user, logout } = useAuthStore();
    const openAuth = useAuthUiStore((s) => s.openAuth);
    const chatUnreadTotal = useChatUnreadStore((s) => s.total);
    const navigate = useNavigate();
    const location = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [hostOpen, setHostOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [notifLoading, setNotifLoading] = useState(false);
    const notifRef = useRef(null);
    const hostRef = useRef(null);
    const profileRef = useRef(null);

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    const loadNotifications = async () => {
        if (!user) return;
        setNotifLoading(true);
        try {
            const res = await notificationsApi.getAll();
            setNotifications(res.data.data || []);
        } catch {
            /* ignore */
        } finally {
            setNotifLoading(false);
        }
    };

    useEffect(() => {
        if (!user) {
            setNotifications([]);
            setNotifOpen(false);
            setHostOpen(false);
            setProfileOpen(false);
            return;
        }
        loadNotifications();
        const interval = setInterval(loadNotifications, 45000);
        return () => clearInterval(interval);
    }, [user?.id]);

    useEffect(() => {
        setMenuOpen(false);
        setNotifOpen(false);
        setHostOpen(false);
        setProfileOpen(false);
    }, [location.pathname, location.search]);

    useEffect(() => {
        const onDoc = (e) => {
            if (notifOpen && notifRef.current && !notifRef.current.contains(e.target)) {
                setNotifOpen(false);
            }
            if (hostOpen && hostRef.current && !hostRef.current.contains(e.target)) {
                setHostOpen(false);
            }
            if (profileOpen && profileRef.current && !profileRef.current.contains(e.target)) {
                setProfileOpen(false);
            }
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [notifOpen, hostOpen, profileOpen]);

    const handleLogout = async () => {
        await logout();
        toast.success('Logged out successfully');
        navigate('/');
        setMenuOpen(false);
    };

    const toggleNotifs = async () => {
        const next = !notifOpen;
        setNotifOpen(next);
        setHostOpen(false);
        setProfileOpen(false);
        if (next) await loadNotifications();
    };

    const markOneRead = async (id) => {
        try {
            await notificationsApi.markRead(id);
            setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
        } catch {
            /* ignore */
        }
    };

    const markAllRead = async () => {
        try {
            await notificationsApi.markAllRead();
            setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        } catch {
            toast.error('Could not mark notifications as read.');
        }
    };

    const openNotification = async (n) => {
        if (!n.isRead) await markOneRead(n.id);
        setNotifOpen(false);
        const data = n.data || {};
        if (data.tripId) navigate(`/trips/${data.tripId}`);
        else if (data.bookingId) navigate('/bookings');
        else if (n.type === 'PAYMENT_RECEIVED' || n.type === 'REQUEST_APPROVED' || n.type === 'REQUEST_REJECTED') {
            navigate('/bookings');
        }
    };

    const isActive = (path) => location.pathname === path;
    const isMyTrips = location.pathname === '/trips' && new URLSearchParams(location.search).get('tab') === 'mine';
    const hostActive = isActive('/trips/create') || isActive('/host') || isMyTrips;
    const isAdmin = user?.role === 'ADMIN';

    const notifPanel = (
        <div className="notif-panel" role="menu">
            <div className="notif-panel-head">
                <strong>Notifications</strong>
                {unreadCount > 0 && (
                    <button type="button" className="notif-mark-all" onClick={markAllRead}>
                        Mark all read
                    </button>
                )}
            </div>
            {notifLoading && notifications.length === 0 ? (
                <p className="notif-empty">Loading…</p>
            ) : notifications.length === 0 ? (
                <p className="notif-empty">No notifications yet.</p>
            ) : (
                <ul className="notif-list">
                    {notifications.map((n) => (
                        <li key={n.id}>
                            <button
                                type="button"
                                className={`notif-item ${n.isRead ? '' : 'unread'}`}
                                onClick={() => openNotification(n)}
                            >
                                <span className="notif-title">{n.title}</span>
                                <span className="notif-body">{n.body}</span>
                                <span className="notif-time">{timeAgo(n.createdAt)}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );

    return (
        <header className={`navbar ${menuOpen ? 'menu-is-open' : ''}`}>
            <div className="container navbar-inner">
                <Link to={isAdmin ? '/admin' : '/'} className="navbar-logo">
                    <span className="logo-mark" aria-hidden="true" />
                    <span className="logo-word">PackAndSync</span>
                </Link>

                {!isAdmin && (
                    <nav className="navbar-links hide-mobile">
                        <Link to="/trips" className={`nav-link nav-link-with-badge ${isActive('/trips') && !isMyTrips ? 'active' : ''}`}>
                            Travel Together
                            {chatUnreadTotal > 0 && (
                                <span className="nav-chat-badge" aria-label={`${chatUnreadTotal} unread chat messages`}>
                                    {chatUnreadTotal > 99 ? '99+' : chatUnreadTotal}
                                </span>
                            )}
                        </Link>
                        <Link to="/rentals" className={`nav-link ${isActive('/rentals') ? 'active' : ''}`}>
                            Car on Rent
                        </Link>
                        <Link to="/explore" className={`nav-link ${isActive('/explore') ? 'active' : ''}`}>
                            Explore
                        </Link>
                        {user && (
                            <Link to="/bookings" className={`nav-link ${isActive('/bookings') ? 'active' : ''}`}>
                                My Bookings
                            </Link>
                        )}
                        {user && (
                            <div className="nav-dropdown" ref={hostRef}>
                                <button
                                    type="button"
                                    className={`nav-link nav-dropdown-trigger ${hostActive || hostOpen ? 'active' : ''}`}
                                    aria-expanded={hostOpen}
                                    onClick={() => {
                                        setHostOpen((v) => !v);
                                        setProfileOpen(false);
                                        setNotifOpen(false);
                                    }}
                                >
                                    Host
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                    </svg>
                                </button>
                                {hostOpen && (
                                    <div className="nav-dropdown-panel">
                                        <Link to="/trips/create" className="nav-dropdown-item" onClick={() => setHostOpen(false)}>
                                            <strong>Post a trip</strong>
                                            <small>Organize a group trip</small>
                                        </Link>
                                        <Link to="/host" className="nav-dropdown-item" onClick={() => setHostOpen(false)}>
                                            <strong>Host a vehicle</strong>
                                            <small>List a car for rent</small>
                                        </Link>
                                        <Link to="/trips?tab=mine" className="nav-dropdown-item" onClick={() => setHostOpen(false)}>
                                            <strong>My trips</strong>
                                            <small>Trips you organize</small>
                                        </Link>
                                    </div>
                                )}
                            </div>
                        )}
                    </nav>
                )}

                <div className="navbar-actions">
                    {user && (
                        <div className="notif-wrap" ref={notifRef}>
                            <button
                                type="button"
                                className="notif-bell"
                                aria-label="Notifications"
                                aria-expanded={notifOpen}
                                onClick={toggleNotifs}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                                </svg>
                                {unreadCount > 0 && <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
                            </button>
                            {notifOpen && notifPanel}
                        </div>
                    )}
                    <div className="hide-mobile">
                        {user ? (
                            <div className="user-menu">
                                <div className="nav-dropdown profile-dropdown" ref={profileRef}>
                                    <button
                                        type="button"
                                        className="user-avatar-btn"
                                        aria-expanded={profileOpen}
                                        onClick={() => {
                                            setProfileOpen((v) => !v);
                                            setHostOpen(false);
                                            setNotifOpen(false);
                                        }}
                                    >
                                        {user.avatarUrl
                                            ? <img src={user.avatarUrl} alt={user.name} className="avatar avatar-sm" />
                                            : <div className="avatar-placeholder avatar-sm" style={{ fontSize: '0.8rem' }}>{user.name[0].toUpperCase()}</div>
                                        }
                                        <span>{user.name}</span>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                        </svg>
                                    </button>
                                    {profileOpen && (
                                        <div className="nav-dropdown-panel profile-panel">
                                            {!isAdmin && (
                                                <>
                                                    <Link
                                                        to={`/profile/${user.id}`}
                                                        className="nav-dropdown-item"
                                                        onClick={() => setProfileOpen(false)}
                                                    >
                                                        <strong>Profile</strong>
                                                        <small>View and edit your account</small>
                                                    </Link>
                                                    <Link
                                                        to="/verify"
                                                        className="nav-dropdown-item"
                                                        onClick={() => setProfileOpen(false)}
                                                    >
                                                        <strong>Verify ID</strong>
                                                        <small>Complete KYC verification</small>
                                                    </Link>
                                                </>
                                            )}
                                            <button type="button" className="nav-dropdown-item danger" onClick={handleLogout}>
                                                <strong>Sync Out</strong>
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <button type="button" className="btn btn-ghost btn-sm nav-auth-logout" onClick={handleLogout}>
                                    Sync Out
                                </button>
                            </div>
                        ) : (
                            <div className="nav-auth-actions">
                                <button
                                    type="button"
                                    className="btn btn-primary btn-sm nav-auth-sync"
                                    onClick={() => openAuth('login')}
                                >
                                    Sync In
                                </button>
                            </div>
                        )}
                    </div>
                    <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
                        <span></span><span></span><span></span>
                    </button>
                </div>
            </div>

            {menuOpen && (
                <div className="mobile-menu">
                    {!isAdmin && (
                        <>
                            <Link to="/trips" onClick={() => setMenuOpen(false)} className="mobile-link">
                                Travel Together
                                {chatUnreadTotal > 0 && (
                                    <span className="nav-chat-badge inline">{chatUnreadTotal > 99 ? '99+' : chatUnreadTotal}</span>
                                )}
                            </Link>
                            <Link to="/rentals" onClick={() => setMenuOpen(false)} className="mobile-link">Car on Rent</Link>
                            <Link to="/explore" onClick={() => setMenuOpen(false)} className="mobile-link">Explore</Link>
                            {user && <Link to="/bookings" onClick={() => setMenuOpen(false)} className="mobile-link">My Bookings</Link>}
                            {user && (
                                <div className="mobile-section">
                                    <p className="mobile-section-label">Host</p>
                                    <Link to="/trips/create" onClick={() => setMenuOpen(false)} className="mobile-link">Post a trip</Link>
                                    <Link to="/host" onClick={() => setMenuOpen(false)} className="mobile-link">Host a vehicle</Link>
                                    <Link to="/trips?tab=mine" onClick={() => setMenuOpen(false)} className="mobile-link">My trips</Link>
                                </div>
                            )}
                        </>
                    )}
                    {user
                        ? (
                            <div className="mobile-section">
                                <p className="mobile-section-label">Account</p>
                                {!isAdmin && (
                                    <>
                                        <Link to={`/profile/${user.id}`} onClick={() => setMenuOpen(false)} className="mobile-link">Profile</Link>
                                        <Link to="/verify" onClick={() => setMenuOpen(false)} className="mobile-link">Verify ID</Link>
                                    </>
                                )}
                                <button onClick={handleLogout} className="mobile-link" style={{ textAlign: 'left', color: 'var(--clr-danger)' }}>Sync Out</button>
                            </div>
                        )
                        : (
                            <div className="mobile-auth-actions">
                                <button
                                    type="button"
                                    className="btn btn-primary w-full nav-auth-sync"
                                    onClick={() => { setMenuOpen(false); openAuth('login'); }}
                                >
                                    Sync In
                                </button>
                            </div>
                        )}
                </div>
            )}
        </header>
    );
}
