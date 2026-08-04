import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../api/index.js';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import './AdminPage.css';

const TABS = [
    { id: 'Overview', label: 'Overview' },
    { id: 'Trust', label: 'Trust' },
    { id: 'Travel', label: 'Trips' },
    { id: 'Rentals', label: 'Rentals' },
    { id: 'Payments', label: 'Payments' },
    { id: 'People', label: 'People' },
];

const ROLES = ['USER', 'ADMIN'];
const BOOKING_STATUSES = ['PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'PAID'];
const TRIP_STATUSES = ['DRAFT', 'OPEN', 'FULL', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const MEMBER_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'LEFT'];

function statusBadgeClass(status) {
    const s = String(status || '').toUpperCase();
    if (['PENDING', 'DRAFT', 'NO'].includes(s)) return 'badge-warning';
    if (['VERIFIED', 'APPROVED', 'CONFIRMED', 'PAID', 'SUCCEEDED', 'OPEN', 'YES', 'ACTIVE'].includes(s)) return 'badge-success';
    if (['REJECTED', 'CANCELLED', 'REFUNDED', 'BANNED', 'LEFT'].includes(s)) return 'badge-danger';
    if (['FULL', 'IN_PROGRESS'].includes(s)) return 'badge-info';
    return 'badge-neutral';
}

export default function AdminPage() {
    const [tab, setTab] = useState('Overview');
    const [stats, setStats] = useState(null);
    const [users, setUsers] = useState([]);
    const [trips, setTrips] = useState([]);
    const [hosts, setHosts] = useState({ tripOrganizers: [], vehicleHosts: [] });
    const [verifications, setVerifications] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [listings, setListings] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [payments, setPayments] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [tripSearch, setTripSearch] = useState('');
    const [kycFilter, setKycFilter] = useState('PENDING');
    const [bookingFilter, setBookingFilter] = useState('');
    const [tripStatusFilter, setTripStatusFilter] = useState('');
    const [trustSub, setTrustSub] = useState('kyc');
    const [travelSub, setTravelSub] = useState('trips');
    const [rentalSub, setRentalSub] = useState('listings');
    const [expandedTrip, setExpandedTrip] = useState(null);

    const fetchStats = useCallback(async () => {
        try {
            const res = await adminApi.getStats();
            setStats(res.data.data);
        } catch {
            toast.error('Failed to load stats.');
        }
    }, []);

    const fetchUsers = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await adminApi.getUsers({ search, limit: 40 });
            setUsers(res.data.data);
        } catch {
            toast.error('Failed to load users.');
        } finally {
            setIsLoading(false);
        }
    }, [search]);

    const fetchTrips = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await adminApi.getTrips({
                limit: 40,
                status: tripStatusFilter || undefined,
                search: tripSearch || undefined,
            });
            setTrips(res.data.data);
        } catch {
            toast.error('Failed to load trips.');
        } finally {
            setIsLoading(false);
        }
    }, [tripStatusFilter, tripSearch]);

    const fetchHosts = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await adminApi.getHosts();
            setHosts(res.data.data);
        } catch {
            toast.error('Failed to load hosts.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const fetchVerifications = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await adminApi.getVerifications({ status: kycFilter, limit: 40 });
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

    const fetchRentals = useCallback(async () => {
        setIsLoading(true);
        try {
            const [listRes, bookRes] = await Promise.all([
                adminApi.getRentalListings(),
                adminApi.getRentalBookings(bookingFilter ? { status: bookingFilter } : {}),
            ]);
            setListings(listRes.data.data);
            setBookings(bookRes.data.data);
        } catch {
            toast.error('Failed to load rentals.');
        } finally {
            setIsLoading(false);
        }
    }, [bookingFilter]);

    const fetchPayments = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await adminApi.getPayments();
            setPayments(res.data.data);
        } catch {
            toast.error('Failed to load payments.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetchStats(); }, [fetchStats]);
    useEffect(() => {
        if (tab === 'People') fetchUsers();
    }, [tab, fetchUsers]);
    useEffect(() => {
        if (tab === 'Travel' && travelSub === 'trips') fetchTrips();
        if (tab === 'Travel' && travelSub === 'hosts') fetchHosts();
    }, [tab, travelSub, fetchTrips, fetchHosts]);
    useEffect(() => {
        if (tab === 'Trust' && trustSub === 'kyc') fetchVerifications();
        if (tab === 'Trust' && trustSub === 'vehicles') fetchVehicles();
    }, [tab, trustSub, fetchVerifications, fetchVehicles]);
    useEffect(() => {
        if (tab === 'Rentals') fetchRentals();
    }, [tab, fetchRentals]);
    useEffect(() => {
        if (tab === 'Payments') fetchPayments();
    }, [tab, fetchPayments]);

    const handleDeleteUser = async (userId) => {
        if (!window.confirm('Delete this user permanently?')) return;
        try {
            await adminApi.deleteUser(userId);
            setUsers((list) => list.filter((u) => u.id !== userId));
            toast.success('User deleted.');
            fetchStats();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete user.');
        }
    };

    const handleRoleChange = async (userId, role) => {
        try {
            await adminApi.updateUserRole(userId, role);
            setUsers((list) => list.map((u) => (u.id === userId ? { ...u, role } : u)));
            toast.success(`Role set to ${role}.`);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update role.');
        }
    };

    const handleBanToggle = async (user) => {
        if (!user.isBanned) {
            const reason = window.prompt('Ban reason:', 'Policy violation');
            if (reason === null) return;
            try {
                await adminApi.banUser(user.id, true, reason || 'Policy violation');
                toast.success('User banned.');
                fetchUsers();
                fetchStats();
            } catch (err) {
                toast.error(err.response?.data?.message || 'Failed to ban user.');
            }
            return;
        }
        try {
            await adminApi.banUser(user.id, false);
            toast.success('User unbanned.');
            fetchUsers();
            fetchStats();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to unban user.');
        }
    };

    const handleDeleteTrip = async (tripId) => {
        if (!window.confirm('Delete this trip for everyone?')) return;
        try {
            await adminApi.deleteTrip(tripId);
            setTrips((list) => list.filter((t) => t.id !== tripId));
            toast.success('Trip deleted.');
            fetchStats();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete trip.');
        }
    };

    const handleTripStatus = async (tripId, status) => {
        try {
            await adminApi.updateTrip(tripId, { status });
            toast.success(`Trip set to ${status}.`);
            fetchTrips();
            fetchStats();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update trip.');
        }
    };

    const handleTripVisibility = async (trip) => {
        try {
            await adminApi.updateTrip(trip.id, { isPublic: !trip.isPublic });
            toast.success(trip.isPublic ? 'Trip hidden from discover.' : 'Trip made public.');
            fetchTrips();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update visibility.');
        }
    };

    const handleMemberStatus = async (tripId, userId, status) => {
        try {
            await adminApi.updateTripMember(tripId, userId, status);
            toast.success(`Member set to ${status}.`);
            fetchTrips();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update member.');
        }
    };

    const handleApproveKyc = async (id) => {
        try {
            await adminApi.approveVerification(id);
            toast.success('KYC approved.');
            fetchVerifications();
            fetchStats();
        } catch {
            toast.error('Approval failed.');
        }
    };

    const handleRejectKyc = async (id) => {
        const reason = window.prompt('Rejection reason (optional):');
        if (reason === null) return;
        try {
            await adminApi.rejectVerification(id, reason || undefined);
            toast.success('KYC rejected.');
            fetchVerifications();
            fetchStats();
        } catch {
            toast.error('Rejection failed.');
        }
    };

    const handleVerifyVehicle = async (id) => {
        try {
            await adminApi.verifyVehicle(id);
            toast.success('Vehicle verified.');
            fetchVehicles();
        } catch {
            toast.error('Vehicle verification failed.');
        }
    };

    const handleRejectVehicle = async (id) => {
        const reason = window.prompt('Rejection reason (optional):');
        if (reason === null) return;
        try {
            await adminApi.rejectVehicle(id, reason || undefined);
            toast.success('Vehicle rejected.');
            fetchVehicles();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Vehicle rejection failed.');
        }
    };

    const handleListingToggle = async (listing) => {
        try {
            await adminApi.setListingActive(listing.id, !listing.isActive);
            toast.success(listing.isActive ? 'Listing deactivated.' : 'Listing activated.');
            fetchRentals();
            fetchStats();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update listing.');
        }
    };

    const handleBookingStatus = async (id, status) => {
        try {
            await adminApi.updateBookingStatus(id, status);
            toast.success(`Booking set to ${status}.`);
            fetchRentals();
            fetchStats();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update booking.');
        }
    };

    const handleRefund = async (id) => {
        if (!window.confirm('Refund this payment?')) return;
        try {
            await adminApi.refundPayment(id);
            toast.success('Payment refunded.');
            fetchPayments();
            fetchStats();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Refund failed.');
        }
    };

    return (
        <div className="admin-page page-enter">
            <div className="admin-shell">
                <div className="admin-topbar">
                    <div className="admin-topbar-copy">
                        <h1>Admin</h1>
                        <p>Moderate trust, trips, rentals, payments, and accounts.</p>
                    </div>
                    <span className="admin-live-pill">Live</span>
                </div>

                <div className="admin-tabs" role="tablist">
                    {TABS.map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            role="tab"
                            aria-selected={tab === t.id}
                            className={`admin-tab ${tab === t.id ? 'active' : ''}`}
                            onClick={() => setTab(t.id)}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {tab === 'Overview' && (
                    <>
                        <div className="admin-kpi-strip">
                            <div className={`admin-kpi ${(stats?.pendingVerifications || 0) > 0 ? 'warn' : 'ok'}`}>
                                <span>Pending KYC</span>
                                <strong>{stats?.pendingVerifications ?? '—'}</strong>
                                <em>Needs review</em>
                            </div>
                            <div className="admin-kpi ok">
                                <span>Open trips</span>
                                <strong>{stats?.openTrips ?? '—'}</strong>
                                <em>{stats?.trips ?? 0} total</em>
                            </div>
                            <div className="admin-kpi">
                                <span>Active listings</span>
                                <strong>{stats?.activeListings ?? '—'}</strong>
                                <em>{stats?.pendingBookings ?? 0} pending bookings</em>
                            </div>
                            <div className="admin-kpi">
                                <span>Revenue</span>
                                <strong>₹{stats != null ? Number(stats.revenue).toLocaleString() : '—'}</strong>
                                <em>{stats?.users ?? 0} users</em>
                            </div>
                        </div>

                        <div className="admin-room-grid">
                            <section className="admin-room-card">
                                <div className="admin-room-card-head">
                                    <div>
                                        <h3>Trust</h3>
                                        <p className="admin-room-desc">ID checks and vehicle RC approval.</p>
                                    </div>
                                </div>
                                <div className="admin-metrics">
                                    <div className="admin-metric"><span>Pending KYC</span><strong>{stats?.pendingVerifications ?? '—'}</strong></div>
                                    <div className="admin-metric"><span>Banned users</span><strong>{stats?.bannedUsers ?? '—'}</strong></div>
                                </div>
                                <div className="admin-actions">
                                    <button type="button" className="btn btn-primary btn-sm" onClick={() => setTab('Trust')}>Review</button>
                                </div>
                            </section>
                            <section className="admin-room-card">
                                <div className="admin-room-card-head">
                                    <div>
                                        <h3>Trips</h3>
                                        <p className="admin-room-desc">Organizers, joiners, and trip status.</p>
                                    </div>
                                </div>
                                <div className="admin-metrics">
                                    <div className="admin-metric"><span>Trips</span><strong>{stats?.trips ?? '—'}</strong></div>
                                    <div className="admin-metric"><span>Organizers</span><strong>{stats?.tripOrganizers ?? '—'}</strong></div>
                                    <div className="admin-metric"><span>Pending joins</span><strong>{stats?.pendingJoins ?? '—'}</strong></div>
                                </div>
                                <div className="admin-actions">
                                    <button type="button" className="btn btn-primary btn-sm" onClick={() => setTab('Travel')}>Manage</button>
                                </div>
                            </section>
                            <section className="admin-room-card">
                                <div className="admin-room-card-head">
                                    <div>
                                        <h3>Rentals</h3>
                                        <p className="admin-room-desc">Hosts, listings, and booking overrides.</p>
                                    </div>
                                </div>
                                <div className="admin-metrics">
                                    <div className="admin-metric"><span>Vehicle hosts</span><strong>{stats?.vehicleHosts ?? '—'}</strong></div>
                                    <div className="admin-metric"><span>Active listings</span><strong>{stats?.activeListings ?? '—'}</strong></div>
                                    <div className="admin-metric"><span>Rental bookings</span><strong>{stats?.rentals ?? '—'}</strong></div>
                                </div>
                                <div className="admin-actions">
                                    <button type="button" className="btn btn-primary btn-sm" onClick={() => setTab('Rentals')}>Manage</button>
                                </div>
                            </section>
                            <section className="admin-room-card">
                                <div className="admin-room-card-head">
                                    <div>
                                        <h3>Money & people</h3>
                                        <p className="admin-room-desc">Refunds, roles, and account access.</p>
                                    </div>
                                </div>
                                <div className="admin-metrics">
                                    <div className="admin-metric"><span>Revenue</span><strong>₹{stats != null ? Number(stats.revenue).toLocaleString() : '—'}</strong></div>
                                    <div className="admin-metric"><span>Users</span><strong>{stats?.users ?? '—'}</strong></div>
                                </div>
                                <div className="admin-actions">
                                    <button type="button" className="btn btn-primary btn-sm" onClick={() => setTab('Payments')}>Payments</button>
                                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTab('People')}>People</button>
                                </div>
                            </section>
                        </div>
                    </>
                )}

                {tab === 'Trust' && (
                    <div className="admin-panel">
                        <div className="admin-panel-head">
                            <div>
                                <h2>Trust</h2>
                                <p>Approve KYC documents and vehicle RC before users unlock the app.</p>
                            </div>
                        </div>
                        <div className="admin-panel-body">
                        <div className="admin-search-row">
                            <div className="admin-subtabs">
                                <button type="button" className={trustSub === 'kyc' ? 'active' : ''} onClick={() => setTrustSub('kyc')}>KYC docs</button>
                                <button type="button" className={trustSub === 'vehicles' ? 'active' : ''} onClick={() => setTrustSub('vehicles')}>Vehicle RC</button>
                            </div>
                            {trustSub === 'kyc' && (
                                <select className="form-input admin-filter-select" value={kycFilter} onChange={(e) => setKycFilter(e.target.value)} style={{ maxWidth: 200 }}>
                                    <option value="PENDING">Pending</option>
                                    <option value="VERIFIED">Verified</option>
                                    <option value="REJECTED">Rejected</option>
                                    <option value="ALL">All</option>
                                </select>
                            )}
                        </div>

                        {trustSub === 'kyc' ? (
                            <div className="admin-table-wrap">
                                <table className="admin-table">
                                    <thead>
                                        <tr><th>User</th><th>Document</th><th>Number</th><th>Status</th><th>Submitted</th><th>Actions</th></tr>
                                    </thead>
                                    <tbody>
                                        {isLoading ? <tr><td colSpan="6">Loading…</td></tr>
                                            : verifications.length === 0 ? <tr><td colSpan="6">No records.</td></tr>
                                                : verifications.map((v) => (
                                                    <tr key={v.id}>
                                                        <td>{v.user?.name}<br /><small>{v.user?.email || v.user?.phoneNumber}</small></td>
                                                        <td>{v.documentType}</td>
                                                        <td>{v.documentNumber || v.digiLockerId || '—'}</td>
                                                        <td><span className={`badge ${statusBadgeClass(v.status)}`}>{v.status}</span></td>
                                                        <td>{format(new Date(v.createdAt), 'MMM d, yyyy')}</td>
                                                        <td className="admin-actions">
                                                            {v.status === 'PENDING' && (
                                                                <>
                                                                    <button type="button" className="btn btn-primary btn-sm" onClick={() => handleApproveKyc(v.id)}>Approve</button>
                                                                    <button type="button" className="btn btn-danger btn-sm" onClick={() => handleRejectKyc(v.id)}>Reject</button>
                                                                </>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="admin-table-wrap">
                                <table className="admin-table">
                                    <thead>
                                        <tr><th>Vehicle</th><th>Owner</th><th>Plate</th><th>RC</th><th>Verified</th><th>Actions</th></tr>
                                    </thead>
                                    <tbody>
                                        {isLoading ? <tr><td colSpan="6">Loading…</td></tr>
                                            : vehicles.map((v) => (
                                                <tr key={v.id}>
                                                    <td>{v.make} {v.model}</td>
                                                    <td>{v.owner?.name}</td>
                                                    <td>{v.licensePlate}</td>
                                                    <td>{v.rcUrl ? 'Submitted' : '—'}</td>
                                                    <td><span className={`badge ${statusBadgeClass(v.isVerified ? 'Yes' : 'No')}`}>{v.isVerified ? 'Yes' : 'No'}</span></td>
                                                    <td className="admin-actions">
                                                        {!v.isVerified ? (
                                                            <>
                                                                <button type="button" className="btn btn-primary btn-sm" onClick={() => handleVerifyVehicle(v.id)}>Verify</button>
                                                                <button type="button" className="btn btn-danger btn-sm" onClick={() => handleRejectVehicle(v.id)}>Reject</button>
                                                            </>
                                                        ) : (
                                                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleRejectVehicle(v.id)}>Revoke</button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        </div>
                    </div>
                )}

                {tab === 'Travel' && (
                    <div className="admin-panel">
                        <div className="admin-panel-head">
                            <div>
                                <h2>Trips</h2>
                                <p>Status, visibility, organizers, and member control.</p>
                            </div>
                        </div>
                        <div className="admin-panel-body">
                        <div className="admin-search-row">
                            <div className="admin-subtabs">
                                <button type="button" className={travelSub === 'trips' ? 'active' : ''} onClick={() => setTravelSub('trips')}>Trips & members</button>
                                <button type="button" className={travelSub === 'hosts' ? 'active' : ''} onClick={() => setTravelSub('hosts')}>Trip organizers</button>
                            </div>
                            {travelSub === 'trips' && (
                                <>
                                    <input
                                        type="search"
                                        className="form-input"
                                        placeholder="Search trips…"
                                        value={tripSearch}
                                        onChange={(e) => setTripSearch(e.target.value)}
                                        style={{ maxWidth: 220 }}
                                    />
                                    <select className="form-input" value={tripStatusFilter} onChange={(e) => setTripStatusFilter(e.target.value)} style={{ maxWidth: 160 }}>
                                        <option value="">All statuses</option>
                                        {TRIP_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </>
                            )}
                        </div>

                        {travelSub === 'hosts' ? (
                            <div className="admin-table-wrap">
                                <table className="admin-table">
                                    <thead>
                                        <tr><th>Organizer</th><th>Contact</th><th>Role</th><th>Trips hosted</th><th>Status</th><th>Profile</th></tr>
                                    </thead>
                                    <tbody>
                                        {isLoading ? <tr><td colSpan="6">Loading…</td></tr>
                                            : hosts.tripOrganizers.map((h) => (
                                                <tr key={h.id}>
                                                    <td>{h.name}</td>
                                                    <td><small>{h.email || h.phoneNumber || '—'}</small></td>
                                                    <td>{h.role}</td>
                                                    <td>{h._count?.organizedTrips ?? 0}</td>
                                                    <td><span className={`badge ${h.isBanned ? 'badge-danger' : 'badge-success'}`}>{h.isBanned ? 'Banned' : 'Active'}</span></td>
                                                    <td><Link to={`/profile/${h.id}`} className="btn btn-ghost btn-sm">Open</Link></td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="admin-trip-list">
                                {isLoading ? <p className="text-muted">Loading…</p>
                                    : trips.length === 0 ? <p className="text-muted">No trips found.</p>
                                        : trips.map((t) => (
                                            <article key={t.id} className="admin-trip-card">
                                                <div className="admin-trip-top">
                                                    <div>
                                                        <h3>{t.title}</h3>
                                                        <p>
                                                            {t.destination} · Host: {t.organizer?.name}
                                                            {' · '}
                                                            {t.members?.filter((m) => m.status === 'APPROVED').length || 0}/{t.maxParticipants} members
                                                        </p>
                                                    </div>
                                                    <div className="admin-actions">
                                                        <select
                                                            className="form-input admin-inline-select"
                                                            value={t.status}
                                                            onChange={(e) => handleTripStatus(t.id, e.target.value)}
                                                        >
                                                            {TRIP_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                                                        </select>
                                                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleTripVisibility(t)}>
                                                            {t.isPublic ? 'Hide' : 'Publish'}
                                                        </button>
                                                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setExpandedTrip(expandedTrip === t.id ? null : t.id)}>
                                                            {expandedTrip === t.id ? 'Hide members' : 'Members'}
                                                        </button>
                                                        <Link to={`/trips/${t.id}`} className="btn btn-ghost btn-sm">Open</Link>
                                                        <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeleteTrip(t.id)}>Delete</button>
                                                    </div>
                                                </div>
                                                {expandedTrip === t.id && (
                                                    <div className="admin-member-panel">
                                                        <table className="admin-table">
                                                            <thead>
                                                                <tr><th>Member</th><th>Status</th><th>Control</th></tr>
                                                            </thead>
                                                            <tbody>
                                                                {(t.members || []).map((m) => (
                                                                    <tr key={m.userId}>
                                                                        <td>
                                                                            {m.user?.name}
                                                                            {m.userId === t.organizerId ? ' (organizer)' : ''}
                                                                            <br /><small>{m.user?.email}</small>
                                                                        </td>
                                                                        <td><span className={`badge ${statusBadgeClass(m.status)}`}>{m.status}</span></td>
                                                                        <td>
                                                                            {m.userId !== t.organizerId ? (
                                                                                <select
                                                                                    className="form-input admin-inline-select"
                                                                                    value={m.status}
                                                                                    onChange={(e) => handleMemberStatus(t.id, m.userId, e.target.value)}
                                                                                >
                                                                                    {MEMBER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                                                                                </select>
                                                                            ) : '—'}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </article>
                                        ))}
                            </div>
                        )}
                        </div>
                    </div>
                )}

                {tab === 'Rentals' && (
                    <div className="admin-panel">
                        <div className="admin-panel-head">
                            <div>
                                <h2>Rentals</h2>
                                <p>Hosts, listings, and booking overrides.</p>
                            </div>
                        </div>
                        <div className="admin-panel-body">
                        <div className="admin-search-row">
                            <div className="admin-subtabs">
                                <button type="button" className={rentalSub === 'listings' ? 'active' : ''} onClick={() => setRentalSub('listings')}>Listings</button>
                                <button type="button" className={rentalSub === 'bookings' ? 'active' : ''} onClick={() => setRentalSub('bookings')}>Bookings</button>
                                <button type="button" className={rentalSub === 'hosts' ? 'active' : ''} onClick={() => { setRentalSub('hosts'); fetchHosts(); }}>Vehicle hosts</button>
                            </div>
                            {rentalSub === 'bookings' && (
                                <select className="form-input" value={bookingFilter} onChange={(e) => setBookingFilter(e.target.value)} style={{ maxWidth: 180 }}>
                                    <option value="">All statuses</option>
                                    {BOOKING_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                            )}
                        </div>

                        {rentalSub === 'hosts' && (
                            <div className="admin-table-wrap">
                                <table className="admin-table">
                                    <thead>
                                        <tr><th>Host</th><th>Contact</th><th>Vehicles</th><th>Listings</th><th>Status</th><th>Profile</th></tr>
                                    </thead>
                                    <tbody>
                                        {hosts.vehicleHosts.map((h) => (
                                            <tr key={h.id}>
                                                <td>{h.name}</td>
                                                <td><small>{h.email || h.phoneNumber || '—'}</small></td>
                                                <td>{h._count?.vehicles ?? 0}</td>
                                                <td>{h._count?.rentalListings ?? 0}</td>
                                                <td><span className={`badge ${h.isBanned ? 'badge-danger' : 'badge-success'}`}>{h.isBanned ? 'Banned' : 'Active'}</span></td>
                                                <td><Link to={`/profile/${h.id}`} className="btn btn-ghost btn-sm">Open</Link></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {rentalSub === 'listings' && (
                            <div className="admin-table-wrap">
                                <table className="admin-table">
                                    <thead>
                                        <tr><th>Vehicle</th><th>Host</th><th>Location</th><th>₹/day</th><th>Active</th><th>Bookings</th><th>Actions</th></tr>
                                    </thead>
                                    <tbody>
                                        {isLoading ? <tr><td colSpan="7">Loading…</td></tr>
                                            : listings.map((l) => (
                                                <tr key={l.id}>
                                                    <td>{l.vehicle?.make} {l.vehicle?.model}</td>
                                                    <td>{l.host?.name}</td>
                                                    <td>{l.location}</td>
                                                    <td>₹{Number(l.pricePerDay).toLocaleString()}</td>
                                                    <td><span className={`badge ${statusBadgeClass(l.isActive ? 'Yes' : 'No')}`}>{l.isActive ? 'Yes' : 'No'}</span></td>
                                                    <td>{l._count?.bookings ?? 0}</td>
                                                    <td>
                                                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleListingToggle(l)}>
                                                            {l.isActive ? 'Deactivate' : 'Activate'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {rentalSub === 'bookings' && (
                            <div className="admin-table-wrap">
                                <table className="admin-table">
                                    <thead>
                                        <tr><th>Vehicle</th><th>Renter</th><th>Host</th><th>Dates</th><th>Total</th><th>Status</th><th>Force status</th></tr>
                                    </thead>
                                    <tbody>
                                        {isLoading ? <tr><td colSpan="7">Loading…</td></tr>
                                            : bookings.map((b) => (
                                                <tr key={b.id}>
                                                    <td>{b.listing?.vehicle?.make} {b.listing?.vehicle?.model}</td>
                                                    <td>{b.renter?.name}</td>
                                                    <td>{b.listing?.host?.name}</td>
                                                    <td>{format(new Date(b.startDate), 'MMM d')} – {format(new Date(b.endDate), 'MMM d')}</td>
                                                    <td>₹{Number(b.totalPrice).toLocaleString()}</td>
                                                    <td><span className={`badge ${statusBadgeClass(b.status)}`}>{b.status}</span></td>
                                                    <td>
                                                        <select
                                                            className="form-input admin-inline-select"
                                                            value={b.status}
                                                            onChange={(e) => handleBookingStatus(b.id, e.target.value)}
                                                        >
                                                            {BOOKING_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                                                        </select>
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        </div>
                    </div>
                )}

                {tab === 'Payments' && (
                    <div className="admin-panel">
                        <div className="admin-panel-head">
                            <div>
                                <h2>Payments</h2>
                                <p>Track money and issue refunds.</p>
                            </div>
                        </div>
                        <div className="admin-panel-body">
                        <div className="admin-table-wrap">
                            <table className="admin-table">
                                <thead>
                                    <tr><th>User</th><th>Amount</th><th>Status</th><th>Ref</th><th>Date</th><th>Actions</th></tr>
                                </thead>
                                <tbody>
                                    {isLoading ? <tr><td colSpan="6">Loading…</td></tr>
                                        : payments.length === 0 ? <tr><td colSpan="6">No payments yet.</td></tr>
                                            : payments.map((p) => (
                                                <tr key={p.id}>
                                                    <td>{p.user?.name}<br /><small>{p.user?.email}</small></td>
                                                    <td>₹{Number(p.amount).toLocaleString()}</td>
                                                    <td>
                                                        <span className={`badge ${statusBadgeClass(p.status)}`}>
                                                            {p.status}
                                                        </span>
                                                    </td>
                                                    <td><small>{p.stripePaymentId?.slice(0, 28)}…</small></td>
                                                    <td>{format(new Date(p.createdAt), 'MMM d, yyyy')}</td>
                                                    <td>
                                                        {p.status === 'succeeded' && (
                                                            <button type="button" className="btn btn-danger btn-sm" onClick={() => handleRefund(p.id)}>Refund</button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                </tbody>
                            </table>
                        </div>
                        </div>
                    </div>
                )}

                {tab === 'People' && (
                    <div className="admin-panel">
                        <div className="admin-panel-head">
                            <div>
                                <h2>People</h2>
                                <p>Roles, bans, and account removal.</p>
                            </div>
                        </div>
                        <div className="admin-panel-body">
                        <div className="admin-search-row">
                            <input
                                type="search"
                                className="form-input"
                                placeholder="Search users…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                style={{ maxWidth: 320 }}
                            />
                        </div>
                        <div className="admin-table-wrap">
                            <table className="admin-table">
                                <thead>
                                    <tr><th>User</th><th>Contact</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr>
                                </thead>
                                <tbody>
                                    {isLoading
                                        ? Array.from({ length: 5 }).map((_, i) => (
                                            <tr key={i}><td colSpan="6"><div className="skeleton" style={{ height: 20 }} /></td></tr>
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
                                                <td><small>{u.email || u.phoneNumber || '—'}</small></td>
                                                <td>
                                                    <select
                                                        className="form-input admin-inline-select"
                                                        value={u.role}
                                                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                                    >
                                                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                                                    </select>
                                                </td>
                                                <td>
                                                    <span className={`badge ${u.isBanned ? 'badge-danger' : 'badge-success'}`}>
                                                        {u.isBanned ? 'Banned' : 'Active'}
                                                    </span>
                                                    {u.banReason && <><br /><small>{u.banReason}</small></>}
                                                </td>
                                                <td>{format(new Date(u.createdAt), 'MMM d, yyyy')}</td>
                                                <td className="admin-actions">
                                                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleBanToggle(u)}>
                                                        {u.isBanned ? 'Unban' : 'Ban'}
                                                    </button>
                                                    <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeleteUser(u.id)}>Delete</button>
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
