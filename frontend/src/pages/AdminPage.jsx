import { useEffect, useState, useCallback } from 'react';
import api, { adminApi } from '../api/index.js';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import './AdminPage.css';

const TABS = ['Overview', 'Verifications', 'Vehicles', 'Users', 'Trips'];

export default function AdminPage() {
    const [tab, setTab] = useState('Overview');
    const [stats, setStats] = useState(null);
    const [users, setUsers] = useState([]);
    const [trips, setTrips] = useState([]);
    const [verifications, setVerifications] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [kycFilter, setKycFilter] = useState('PENDING');

    const fetchStats = useCallback(async () => {
        try {
            const res = await api.get('/admin/stats');
            setStats(res.data.data);
        } catch { toast.error('Failed to load stats.'); }
    }, []);

    const fetchUsers = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await api.get('/admin/users', { params: { search, limit: 20 } });
            setUsers(res.data.data);
        } catch { }
        finally { setIsLoading(false); }
    }, [search]);

    const fetchTrips = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await api.get('/admin/trips', { params: { limit: 20 } });
            setTrips(res.data.data);
        } catch { }
        finally { setIsLoading(false); }
    }, []);

    const fetchVerifications = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await adminApi.getVerifications({ status: kycFilter, limit: 30 });
            setVerifications(res.data.data);
        } catch {
            toast.error('Failed to load verifications.');
        } finally {
            setIsLoading(false);
        }
    }, [kycFilter]);

    const fetchVehicles = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await adminApi.getVehicles();
            setVehicles(res.data.data);
        } catch {
            toast.error('Failed to load vehicles.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetchStats(); }, [fetchStats]);
    useEffect(() => { if (tab === 'Users') fetchUsers(); }, [tab, fetchUsers]);
    useEffect(() => { if (tab === 'Trips') fetchTrips(); }, [tab, fetchTrips]);
    useEffect(() => { if (tab === 'Verifications') fetchVerifications(); }, [tab, fetchVerifications]);
    useEffect(() => { if (tab === 'Vehicles') fetchVehicles(); }, [tab, fetchVehicles]);

    const handleDeleteUser = async (userId) => {
        if (!window.confirm('Delete this user?')) return;
        try {
            await api.delete(`/admin/users/${userId}`);
            setUsers((u) => u.filter((u) => u.id !== userId));
            toast.success('User deleted.');
        } catch { toast.error('Failed to delete user.'); }
    };

    const handleDeleteTrip = async (tripId) => {
        if (!window.confirm('Delete this trip?')) return;
        try {
            await api.delete(`/admin/trips/${tripId}`);
            setTrips((t) => t.filter((t) => t.id !== tripId));
            toast.success('Trip deleted.');
        } catch { toast.error('Failed to delete trip.'); }
    };

    const handleApproveKyc = async (id) => {
        try {
            await adminApi.approveVerification(id);
            toast.success('Verification approved.');
            fetchVerifications();
            fetchStats();
        } catch {
            toast.error('Approval failed.');
        }
    };

    const handleRejectKyc = async (id) => {
        const reason = window.prompt('Rejection reason (optional):');
        try {
            await adminApi.rejectVerification(id, reason || undefined);
            toast.success('Verification rejected.');
            fetchVerifications();
        } catch {
            toast.error('Rejection failed.');
        }
    };

    const handleVerifyVehicle = async (id) => {
        try {
            await adminApi.verifyVehicle(id);
            toast.success('Vehicle marked verified.');
            fetchVehicles();
        } catch {
            toast.error('Vehicle verification failed.');
        }
    };

    return (
        <div className="admin-page page-enter">
            <div className="container">
                <div className="admin-header">
                    <h1>Admin Dashboard</h1>
                    <p>Review KYC, manage users, trips, and platform health.</p>
                </div>

                <div className="admin-tabs">
                    {TABS.map((t) => (
                        <button key={t} className={`admin-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>
                    ))}
                </div>

                {tab === 'Overview' && (
                    <div className="admin-stats">
                        {[
                            { label: 'Total Users', value: stats?.users ?? '—', emoji: '👤' },
                            { label: 'Pending KYC', value: stats?.pendingVerifications ?? '—', emoji: '🛡️' },
                            { label: 'Ride Bookings', value: stats?.rides ?? '—', emoji: '🚗' },
                            { label: 'Rental Bookings', value: stats?.rentals ?? '—', emoji: '🔑' },
                            { label: 'Total Trips', value: stats?.trips ?? '—', emoji: '🗺️' },
                            { label: 'Revenue', value: stats ? `$${stats.revenue.toLocaleString()}` : '—', emoji: '💰' },
                        ].map((s) => (
                            <div key={s.label} className="stat-card card">
                                <span className="stat-emoji">{s.emoji}</span>
                                <span className="stat-value gradient-text">{s.value}</span>
                                <span className="stat-label">{s.label}</span>
                            </div>
                        ))}
                    </div>
                )}

                {tab === 'Verifications' && (
                    <div>
                        <div className="admin-search-row">
                            <select className="form-input" value={kycFilter} onChange={(e) => setKycFilter(e.target.value)} style={{ maxWidth: 200 }}>
                                <option value="PENDING">Pending</option>
                                <option value="VERIFIED">Verified</option>
                                <option value="REJECTED">Rejected</option>
                                <option value="ALL">All</option>
                            </select>
                        </div>
                        <div className="admin-table-wrap">
                            <table className="admin-table">
                                <thead>
                                    <tr><th>User</th><th>Document</th><th>Number</th><th>Status</th><th>Submitted</th><th>Actions</th></tr>
                                </thead>
                                <tbody>
                                    {isLoading ? (
                                        <tr><td colSpan="6">Loading…</td></tr>
                                    ) : verifications.length === 0 ? (
                                        <tr><td colSpan="6">No verification records.</td></tr>
                                    ) : verifications.map((v) => (
                                        <tr key={v.id}>
                                            <td>{v.user?.name}<br /><small>{v.user?.email || v.user?.phoneNumber}</small></td>
                                            <td>{v.documentType}</td>
                                            <td>{v.documentNumber || v.digiLockerId || '—'}</td>
                                            <td><span className={`badge ${v.status === 'VERIFIED' ? 'badge-info' : v.status === 'REJECTED' ? 'badge-danger' : 'badge-neutral'}`}>{v.status}</span></td>
                                            <td>{format(new Date(v.createdAt), 'MMM d, yyyy')}</td>
                                            <td>
                                                {v.status === 'PENDING' && (
                                                    <>
                                                        <button className="btn btn-primary btn-sm" onClick={() => handleApproveKyc(v.id)}>Approve</button>{' '}
                                                        <button className="btn btn-danger btn-sm" onClick={() => handleRejectKyc(v.id)}>Reject</button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {tab === 'Vehicles' && (
                    <div className="admin-table-wrap">
                        <table className="admin-table">
                            <thead>
                                <tr><th>Vehicle</th><th>Owner</th><th>Plate</th><th>RC</th><th>Verified</th><th>Actions</th></tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr><td colSpan="6">Loading…</td></tr>
                                ) : vehicles.map((v) => (
                                    <tr key={v.id}>
                                        <td>{v.make} {v.model}</td>
                                        <td>{v.owner?.name}</td>
                                        <td>{v.licensePlate}</td>
                                        <td>{v.rcUrl ? 'Submitted' : '—'}</td>
                                        <td><span className={`badge ${v.isVerified ? 'badge-info' : 'badge-neutral'}`}>{v.isVerified ? 'Yes' : 'No'}</span></td>
                                        <td>
                                            {!v.isVerified && (
                                                <button className="btn btn-primary btn-sm" onClick={() => handleVerifyVehicle(v.id)}>Verify RC</button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {tab === 'Users' && (
                    <div>
                        <div className="admin-search-row">
                            <input type="search" className="form-input" placeholder="🔍 Search users…"
                                value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 320 }} />
                        </div>
                        <div className="admin-table-wrap">
                            <table className="admin-table">
                                <thead>
                                    <tr><th>User</th><th>Email</th><th>Role</th><th>Joined</th><th>Actions</th></tr>
                                </thead>
                                <tbody>
                                    {isLoading
                                        ? Array.from({ length: 5 }).map((_, i) => (
                                            <tr key={i}><td colSpan="5"><div className="skeleton" style={{ height: 20 }} /></td></tr>
                                        ))
                                        : users.map((u) => (
                                            <tr key={u.id}>
                                                <td>
                                                    <div className="flex items-center gap-3">
                                                        {u.avatarUrl
                                                            ? <img src={u.avatarUrl} alt={u.name} className="avatar avatar-sm" />
                                                            : <div className="avatar-placeholder avatar-sm" style={{ fontSize: '0.75rem' }}>{u.name[0]}</div>
                                                        }
                                                        <span>{u.name}</span>
                                                    </div>
                                                </td>
                                                <td>{u.email}</td>
                                                <td><span className={`badge ${u.role === 'ADMIN' ? 'badge-danger' : u.role === 'ORGANIZER' ? 'badge-info' : 'badge-neutral'}`}>{u.role}</span></td>
                                                <td>{format(new Date(u.createdAt), 'MMM d, yyyy')}</td>
                                                <td>
                                                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteUser(u.id)}>Delete</button>
                                                </td>
                                            </tr>
                                        ))
                                    }
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {tab === 'Trips' && (
                    <div className="admin-table-wrap">
                        <table className="admin-table">
                            <thead>
                                <tr><th>Trip</th><th>Destination</th><th>Organizer</th><th>Members</th><th>Status</th><th>Actions</th></tr>
                            </thead>
                            <tbody>
                                {isLoading
                                    ? Array.from({ length: 5 }).map((_, i) => (
                                        <tr key={i}><td colSpan="6"><div className="skeleton" style={{ height: 20 }} /></td></tr>
                                    ))
                                    : trips.map((t) => (
                                        <tr key={t.id}>
                                            <td><strong>{t.title}</strong></td>
                                            <td>{t.destination}</td>
                                            <td>{t.organizer?.name}</td>
                                            <td>{t._count?.members ?? 0} / {t.maxParticipants}</td>
                                            <td><span className="badge badge-neutral">{t.status}</span></td>
                                            <td><button className="btn btn-danger btn-sm" onClick={() => handleDeleteTrip(t.id)}>Delete</button></td>
                                        </tr>
                                    ))
                                }
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
