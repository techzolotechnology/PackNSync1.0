import { Routes, Route, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from './store/authStore.js';
import { useAuthUiStore } from './store/authUiStore.js';
import Navbar from './components/Navbar.jsx';
import AuthModal from './components/AuthModal.jsx';
import HomePage from './pages/HomePage.jsx';
import TripsPage from './pages/TripsPage.jsx';
import TripDetailPage from './pages/TripDetailPage.jsx';
import CreateTripPage from './pages/CreateTripPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import RentalsPage from './pages/RentalsPage.jsx';
import MyBookingsPage from './pages/MyBookingsPage.jsx';
import HostDashboard from './pages/HostDashboard.jsx';
import VerificationPage from './pages/VerificationPage.jsx';
import PrivacyPolicy from './pages/PrivacyPolicy.jsx';
import TermsPage from './pages/TermsPage.jsx';
import ExplorePage from './pages/ExplorePage.jsx';
import Footer from './components/Footer.jsx';
import ChatUnreadBridge from './components/ChatUnreadBridge.jsx';

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

const PrivateRoute = ({ children }) => {
    const user = useAuthStore((s) => s.user);
    const openAuth = useAuthUiStore((s) => s.openAuth);
    useEffect(() => {
        if (!user) openAuth('login');
    }, [user, openAuth]);
    return user ? children : <Navigate to="/?auth=login" replace />;
};

const AdminRoute = ({ children }) => {
    const user = useAuthStore((s) => s.user);
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
    const { pathname } = useLocation();

    useEffect(() => {
        fetchMe();
    }, [fetchMe]);

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Navbar />
            <AuthModal />
            <AuthQueryBridge />
            <ChatUnreadBridge />
            <main style={{ flex: 1 }}>
                <Routes>
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
                    <Route path="/host" element={<BlockAdminFromApp><PrivateRoute><HostDashboard /></PrivateRoute></BlockAdminFromApp>} />
                    <Route path="/verify" element={<BlockAdminFromApp><PrivateRoute><VerificationPage /></PrivateRoute></BlockAdminFromApp>} />
                    <Route path="/terms/:type" element={<TermsPage />} />
                    <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                    <Route path="*" element={<Navigate to={user?.role === 'ADMIN' ? '/admin' : '/'} replace />} />
                </Routes>
            </main>
            {!HIDE_FOOTER_PATHS.has(pathname) && (!user || user.role !== 'ADMIN') ? <Footer /> : null}
        </div>
    );
}
