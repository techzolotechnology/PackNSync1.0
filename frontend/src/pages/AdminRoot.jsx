import AdminMfaGate from '../components/admin/AdminMfaGate.jsx';
import AdminPage from './AdminPage.jsx';
import './AdminOps.css';
import '../components/admin/AdminTools.css';

/** The admin panel only mounts after the two-factor check passes. */
export default function AdminRoot() {
    return (
        <AdminMfaGate>
            <AdminPage />
        </AdminMfaGate>
    );
}
