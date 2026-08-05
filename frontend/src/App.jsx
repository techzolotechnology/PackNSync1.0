import { Routes, Route, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useAuthStore } from './store/authStore.js';
import { useAuthUiStore } from './store/authUiStore.js';
import Navbar from './components/Navbar.jsx';
import AuthModal from './components/AuthModal.jsx';
import HomePage from './pages/HomePage.jsx';
import TripsPage from './pages/TripsPage.jsx';
import CreateTripPage from './pages/CreateTripPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import MyBookingsPage from './pages/MyBookingsPage.jsx';
import VerificationPage from './pages/VerificationPage.jsx';
import Footer from './components/Footer.jsx';
import ChatUnreadBridge from './components/ChatUnreadBridge.jsx';
import PageTransition from './components/motion/PageTransition.jsx';
import MotionBridge from './components/motion/MotionBridge.jsx';

// Heavy routes are code-split so the initial bundle stays small.
const AdminPage = lazy(() => import('./pages/AdminPage.jsx'));
const ExplorePage = lazy(() => import('./pages/ExplorePage.jsx'));
const RentalsPage = lazy(() => import('./pages/RentalsPage.jsx'));
const TripDetailPage = lazy(() => import('./pages/TripDetailPage.jsx'));
const HostDashboard = lazy(() => import('./pages/HostDashboard.jsx'));
const WalletPage = lazy(() => import('./pages/WalletPage.jsx'));
const TermsAndConditions = lazy(() => import('./pages/TermsAndConditions.jsx'));
const TermsPage = lazy(() => import('./pages/TermsPage.jsx'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy.jsx'));
const RefundPolicy = lazy(() => import('./pages/RefundPolicy.jsx'));

const HIDE_FOOTER_PATHS = new Set(['/explore']);

/** Old /login and /register URLs → home + open auth modal */
function AuthRouteRedirect({ mode }) {
    const openAuth = useAuthUiStore((s) => s.openAuth);
    useEffect(() => {
        openAuth(mode);
    }, [mode, openAuth]);
    return <Navigate to="/" replace />;
}

/** ?auth=login | ?auth=register on any page opens the modal once */
function AuthQueryBridge() {
    const [params, setParams] = useSearchParams();
    const openAuth = useAuthUiStore((s) => s.openAuth);
    useEffect(() => {
        const auth = params.get('auth');
        if (auth === 'login' || auth === 'register') {
            openAuth(auth);
            const next = new URLSearchParams(params);
            next.delete('auth');
            setParams(next, { replace: true });
        }
    }, [params, setParams, openAuth]);
    return null;
}

/** Wait for zustand persist — otherwise reload flashes user=null and kicks private pages away. */
function useAuthHydrated() {
    const [hydrated, setHydrated] = useState(() => {
        try {
            return useAuthStore.persist.hasHydrated();
        } catch {
            return true;
        }
    });
    useEffect(() => {
        try {
            if (useAuthStore.persist.hasHydrated()) {
                setHydrated(true);
                return undefined;
            }
            return useAuthStore.persist.onFinishHydration(() => setHydrated(true));
        } catch {
            setHydrated(true);
            return undefined;
        }
    }, []);
    return hydrated;
}

const PrivateRoute = ({ children }) => {
    const user = useAuthStore((s) => s.user);
    const hydrated = useAuthHydrated();
    const location = useLocation();
    const openAuth = useAuthUiStore((s) => s.openAuth);

    useEffect(() => {
        if (hydrated && !user) openAuth('login');
    }, [hydrated, user, openAuth]);

    if (!hydrated) {
        return <div className="page-auth-pending" aria-busy="true" />;
    }
    if (!user) {
        const next = encodeURIComponent(`${location.pathname}${location.search}`);
        return <Navigate to={`/?auth=login&next=${next}`} replace />;
    }
    return children;
};

const AdminRoute = ({ children }) => {
    const user = useAuthStore((s) => s.user);
    const hydrated = useAuthHydrated();
    if (!hydrated) return <div className="page-auth-pending" aria-busy="true" />;
    if (!user) return <Navigate to="/?auth=login" replace />;
    if (user.role !== 'ADMIN') return <Navigate to="/" replace />;
    return children;
};

const BlockAdminFromApp = ({ children }) => {
    const user = useAuthStore((s) => s.user);
    if (user?.role === 'ADMIN') return <Navigate to="/admin" replace />;
    return children;
};

export default function App() {
    const user = useAuthStore((s) => s.user);
    const fetchMe = useAuthStore((s) => s.fetchMe);
    const location = useLocation();
    const { pathname } = location;

    useEffect(() => {
        fetchMe();
    }, [fetchMe]);

    return (
        <div className="app-shell">
            <Navbar />
            <AuthModal />
            <AuthQueryBridge />
            <ChatUnreadBridge />
            <main className="app-page">
                <MotionBridge />
                <PageTransition>
                    <Suspense fallback={<div className="page-auth-pending" aria-busy="true" />}>
                    <Routes location={location}>
                    <Route path="/" element={<BlockAdminFromApp><HomePage /></BlockAdminFromApp>} />
                    <Route path="/login" element={user?.role === 'ADMIN' ? <Navigate to="/admin" replace /> : <AuthRouteRedirect mode="login" />} />
                    <Route path="/register" element={<BlockAdminFromApp><AuthRouteRedirect mode="register" /></BlockAdminFromApp>} />
                    <Route path="/trips" element={<BlockAdminFromApp><TripsPage /></BlockAdminFromApp>} />
                    <Route path="/trips/create" element={<BlockAdminFromApp><PrivateRoute><CreateTripPage /></PrivateRoute></BlockAdminFromApp>} />
                    <Route path="/trips/:id" element={<BlockAdminFromApp><TripDetailPage /></BlockAdminFromApp>} />
                    <Route path="/profile/:id" element={<BlockAdminFromApp><PrivateRoute><ProfilePage /></PrivateRoute></BlockAdminFromApp>} />
                    <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
                    <Route path="/rides" element={<Navigate to={user?.role === 'ADMIN' ? '/admin' : '/trips'} replace />} />
                    <Route path="/rentals" element={<BlockAdminFromApp><RentalsPage /></BlockAdminFromApp>} />
                    <Route path="/explore" element={<BlockAdminFromApp><ExplorePage /></BlockAdminFromApp>} />
                    <Route path="/bookings" element={<BlockAdminFromApp><PrivateRoute><MyBookingsPage /></PrivateRoute></BlockAdminFromApp>} />
                    <Route path="/wallet" element={<BlockAdminFromApp><PrivateRoute><WalletPage /></PrivateRoute></BlockAdminFromApp>} />
                    <Route path="/host" element={<BlockAdminFromApp><PrivateRoute><HostDashboard /></PrivateRoute></BlockAdminFromApp>} />
                    <Route path="/verify" element={<BlockAdminFromApp><PrivateRoute><VerificationPage /></PrivateRoute></BlockAdminFromApp>} />
                    <Route path="/terms" element={<TermsAndConditions />} />
                    <Route path="/terms/:type" element={<TermsPage />} />
                    <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                    <Route path="/refund-policy" element={<RefundPolicy />} />
                    <Route path="*" element={<Navigate to={user?.role === 'ADMIN' ? '/admin' : '/'} replace />} />
                    </Routes>
                    </Suspense>
                </PageTransition>
            </main>
            {!HIDE_FOOTER_PATHS.has(pathname) && (!user || user.role !== 'ADMIN') ? <Footer /> : null}
        </div>
    );
}
