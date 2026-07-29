import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from './store/authStore.js';
import Navbar from './components/Navbar.jsx';
import HomePage from './pages/HomePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
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

const AUTH_SHELL_PATHS = new Set(['/login', '/register']);
const HIDE_FOOTER_PATHS = new Set(['/login', '/register', '/explore']);

const PrivateRoute = ({ children }) => {
    const user = useAuthStore((s) => s.user);
    return user ? children : <Navigate to="/login" replace />;
};

const AdminRoute = ({ children }) => {
    const user = useAuthStore((s) => s.user);
    if (!user) return <Navigate to="/login" replace />;
    if (user.role !== 'ADMIN') return <Navigate to="/" replace />;
    return children;
};

/** Admins stay in the control room — no traveler/host product UI. */
const BlockAdminFromApp = ({ children }) => {
    const user = useAuthStore((s) => s.user);
    if (user?.role === 'ADMIN') return <Navigate to="/admin" replace />;
    return children;
};

export default function App() {
    const user = useAuthStore((s) => s.user);
    const fetchMe = useAuthStore((s) => s.fetchMe);
    const { pathname } = useLocation();
    const isAuthShell = AUTH_SHELL_PATHS.has(pathname);

    useEffect(() => {
        fetchMe();
    }, [fetchMe]);

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            {!isAuthShell && <Navbar />}
            <ChatUnreadBridge />
            <main style={{ flex: 1 }}>
                <Routes>
                    <Route path="/" element={<BlockAdminFromApp><HomePage /></BlockAdminFromApp>} />
                    <Route path="/login" element={user?.role === 'ADMIN' ? <Navigate to="/admin" replace /> : <LoginPage />} />
                    <Route path="/register" element={<BlockAdminFromApp><RegisterPage /></BlockAdminFromApp>} />
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
