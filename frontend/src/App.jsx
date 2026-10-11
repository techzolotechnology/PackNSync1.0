import { Routes, Route, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useAuthStore } from './store/authStore.js';
import { useAuthUiStore } from './store/authUiStore.js';
import Navbar from './components/Navbar.jsx';
import SplashScreen from './components/SplashScreen.jsx';
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
import ScrollManager from './components/ScrollManager.jsx';
import MotionBridge from './components/motion/MotionBridge.jsx';
import { HERO_MEDIA } from './utils/heroMedia.js';
import RouteSeo from './components/RouteSeo.jsx';
import { findRentalCity } from './seo/seoConfig.js';
import { rememberReferral } from './utils/referral.js';

// Heavy routes are code-split so the initial bundle stays small.
const loadExplore = () => import('./pages/ExplorePage.jsx');
const loadRentals = () => import('./pages/RentalsPage.jsx');
const loadTripDetail = () => import('./pages/TripDetailPage.jsx');
const loadWallet = () => import('./pages/WalletPage.jsx');
const loadDestinations = () => import('./pages/DestinationsPage.jsx');
const loadDestination = () => import('./pages/DestinationPage.jsx');
const loadGuides = () => import('./pages/GuidesPage.jsx');
const loadGuide = () => import('./pages/GuidePage.jsx');
const loadCostSplitter = () => import('./pages/CostSplitterPage.jsx');
const loadBecomeHost = () => import('./pages/BecomeHostPage.jsx');

const AdminPage = lazy(() => import('./pages/AdminRoot.jsx'));
const ExplorePage = lazy(loadExplore);
const RentalsPage = lazy(loadRentals);
const TripDetailPage = lazy(loadTripDetail);
const HostDashboard = lazy(() => import('./pages/HostDashboard.jsx'));
const WalletPage = lazy(loadWallet);
const TermsAndConditions = lazy(() => import('./pages/TermsAndConditions.jsx'));
const TermsPage = lazy(() => import('./pages/TermsPage.jsx'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy.jsx'));
const RefundPolicy = lazy(() => import('./pages/RefundPolicy.jsx'));
const DestinationsPage = lazy(loadDestinations);
const DestinationPage = lazy(loadDestination);
const GuidesPage = lazy(loadGuides);
const GuidePage = lazy(loadGuide);
const CostSplitterPage = lazy(loadCostSplitter);
const BecomeHostPage = lazy(loadBecomeHost);
const ReportsPage = lazy(() => import('./pages/ReportsPage.jsx'));
const NewReportPage = lazy(() => import('./pages/NewReportPage.jsx'));
// Wallet top-ups started in the mobile app (pay in the browser, then back to the app)
const PayPage = lazy(() => import('./pages/PayPage.jsx'));
const PayDonePage = lazy(() => import('./pages/PayPage.jsx').then((m) => ({ default: m.PayDonePage })));

/** Pages people usually open next; fetched once the browser is idle so they open without a wait. */
const PRELOAD_PAGES = [
    loadRentals, loadTripDetail, loadExplore, loadDestinations, loadDestination,
    loadGuides, loadGuide, loadCostSplitter, loadBecomeHost, loadWallet,
];

function usePreloadPages() {
    useEffect(() => {
        const preload = () => PRELOAD_PAGES.forEach((load) => load().catch(() => {}));
        if ('requestIdleCallback' in window) {
            const id = window.requestIdleCallback(preload, { timeout: 5000 });
            return () => window.cancelIdleCallback(id);
        }
        const id = window.setTimeout(preload, 3000);
        return () => window.clearTimeout(id);
    }, []);
}

const HIDE_FOOTER_PATHS = new Set(['/explore']);

/** /rentals/:city landing pages; unknown cities fall back to /rentals. */
function RentalsCityRoute() {
    const { city: slug } = useParams();
    const city = findRentalCity(slug);
    if (!city) return <Navigate to="/rentals" replace />;
    // key: remount when switching cities so the search box resets
    return <RentalsPage key={city.slug} city={city} />;
}

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

/** ?ref=CODE on any page: remember the referrer for sign-up, then tidy the URL. */
function ReferralBridge() {
    const [params, setParams] = useSearchParams();
    useEffect(() => {
        const ref = params.get('ref');
        if (!ref) return;
        rememberReferral(ref);
        const next = new URLSearchParams(params);
        next.delete('ref');
        setParams(next, { replace: true });
    }, [params, setParams]);
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
    const hydrated = useAuthHydrated();
    const [booted, setBooted] = useState(false);
    const location = useLocation();
    const { pathname } = location;
    const hasTripsVideoBackground = pathname === '/trips';

    useEffect(() => {
        fetchMe();
    }, [fetchMe]);
    usePreloadPages();

    return (
        <div className={`app-shell ${hasTripsVideoBackground ? 'app-shell--trips-video' : ''}`}>
            {hasTripsVideoBackground && HERO_MEDIA && (
                <video
                    className="app-shell-video"
                    poster={HERO_MEDIA.poster}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    aria-hidden="true"
                >
                    <source src={HERO_MEDIA.video} type="video/mp4" />
                </video>
            )}
            {hasTripsVideoBackground && <div className="app-shell-video-overlay" aria-hidden="true" />}
            {!booted && <SplashScreen ready={hydrated} onDone={() => setBooted(true)} />}
            <RouteSeo />
            <Navbar />
            <AuthModal />
            <AuthQueryBridge />
            <ReferralBridge />
            <ChatUnreadBridge />
            <main className="app-page">
                <ScrollManager />
                <MotionBridge />
                {/* Suspense sits outside the keyed transition so, during navigation, the current
                    page stays on screen while the next page's code loads (v7_startTransition). */}
                <Suspense fallback={<div className="page-auth-pending" aria-busy="true" />}>
                <PageTransition>
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
                    <Route path="/rentals/:city" element={<BlockAdminFromApp><RentalsCityRoute /></BlockAdminFromApp>} />
                    <Route path="/guides" element={<BlockAdminFromApp><GuidesPage /></BlockAdminFromApp>} />
                    <Route path="/guides/:slug" element={<BlockAdminFromApp><GuidePage /></BlockAdminFromApp>} />
                    <Route path="/tools/trip-cost-splitter" element={<CostSplitterPage />} />
                    <Route path="/become-a-host" element={<BlockAdminFromApp><BecomeHostPage /></BlockAdminFromApp>} />
                    <Route path="/destinations" element={<BlockAdminFromApp><DestinationsPage /></BlockAdminFromApp>} />
                    <Route path="/destinations/:slug" element={<BlockAdminFromApp><DestinationPage /></BlockAdminFromApp>} />
                    <Route path="/explore" element={<BlockAdminFromApp><ExplorePage /></BlockAdminFromApp>} />
                    <Route path="/bookings" element={<BlockAdminFromApp><PrivateRoute><MyBookingsPage /></PrivateRoute></BlockAdminFromApp>} />
                    <Route path="/wallet" element={<BlockAdminFromApp><PrivateRoute><WalletPage /></PrivateRoute></BlockAdminFromApp>} />
                    <Route path="/host" element={<BlockAdminFromApp><PrivateRoute><HostDashboard /></PrivateRoute></BlockAdminFromApp>} />
                    <Route path="/reports" element={<BlockAdminFromApp><PrivateRoute><ReportsPage /></PrivateRoute></BlockAdminFromApp>} />
                    <Route path="/reports/new" element={<BlockAdminFromApp><PrivateRoute><NewReportPage /></PrivateRoute></BlockAdminFromApp>} />
                    <Route path="/reports/:id" element={<BlockAdminFromApp><PrivateRoute><ReportsPage /></PrivateRoute></BlockAdminFromApp>} />
                    <Route path="/verify" element={<BlockAdminFromApp><PrivateRoute><VerificationPage /></PrivateRoute></BlockAdminFromApp>} />
                    <Route path="/terms" element={<TermsAndConditions />} />
                    <Route path="/terms/:type" element={<TermsPage />} />
                    <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                    <Route path="/refund-policy" element={<RefundPolicy />} />
                    <Route path="/pay" element={<PayPage />} />
                    <Route path="/pay/done" element={<PayDonePage />} />
                    <Route path="*" element={<Navigate to={user?.role === 'ADMIN' ? '/admin' : '/'} replace />} />
                    </Routes>
                </PageTransition>
                </Suspense>
            </main>
            {!HIDE_FOOTER_PATHS.has(pathname) && (!user || user.role !== 'ADMIN') ? <Footer /> : null}
        </div>
    );
}
