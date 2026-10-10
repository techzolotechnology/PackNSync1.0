import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { tripsApi, expensesApi } from '../api/index.js';
import { useAuthStore } from '../store/authStore.js';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import LocationAutocomplete from '../components/LocationAutocomplete.jsx';
import CoverImagePicker from '../components/CoverImagePicker.jsx';
import TripCarSuggestions from '../components/TripCarSuggestions.jsx';
import TripChat from '../components/TripChat.jsx';
import { useChatUnreadStore } from '../store/chatUnreadStore.js';
import { displayName } from '../utils/displayName.js';
import useSeo from '../hooks/useSeo.js';
import { mediaUrl } from '../utils/mediaUrl.js';
import { useAuthUiStore } from '../store/authUiStore.js';
import { BACKEND_ORIGIN } from '../config/backend.js';
import { copyLink, shareLink } from '../utils/share.js';

const PENDING_JOIN_KEY = 'pns.pendingJoin';

/** Same rules the server applies; a valid invite also upgrades a pending request. */
function computeCanJoin(trip, myMembership, userId) {
    if (!trip || userId === trip.organizerId) return false;
    const statusOk = !myMembership
        || ['REJECTED', 'LEFT'].includes(myMembership.status)
        || (trip.viaInvite && myMembership.status === 'PENDING');
    return statusOk && ['OPEN', 'DRAFT'].includes(trip.status);
}
import './TripDetailPage.css';

const STATUS_BADGE = {
    OPEN: 'badge-success',
    FULL: 'badge-warning',
    IN_PROGRESS: 'badge-info',
    COMPLETED: 'badge-neutral',
    DRAFT: 'badge-neutral',
    CANCELLED: 'badge-danger',
};

const toInputDate = (value) => {
    if (!value) return '';
    try {
        return new Date(value).toISOString().slice(0, 10);
    } catch {
        return '';
    }
};

const emptyEditForm = {
    title: '',
    description: '',
    destination: '',
    coverImageUrl: '',
    startDate: '',
    endDate: '',
    maxParticipants: 6,
    budgetEstimate: '',
    status: 'OPEN',
    isPublic: true,
};

export default function TripDetailPage() {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const inviteCode = searchParams.get('invite') || null;
    const { user } = useAuthStore();
    const openAuth = useAuthUiStore((s) => s.openAuth);
    const [sharing, setSharing] = useState(false);
    const chatUnreadForTrip = useChatUnreadStore((s) => s.byTrip[id] || 0);
    const navigate = useNavigate();
    const [trip, setTrip] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isJoining, setIsJoining] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');
    const [expenses, setExpenses] = useState([]);
    const [balances, setBalances] = useState({});
    const [expenseForm, setExpenseForm] = useState({ title: '', amount: '', category: 'OTHER' });
    const [savingExpense, setSavingExpense] = useState(false);
    const [announcementForm, setAnnouncementForm] = useState({ title: '', content: '', isPinned: false });

    useSeo(trip ? {
        title: `${trip.title} – Group Trip to ${trip.destination} | PickAndSync`,
        description: (trip.description?.trim()
            || `Join a group trip to ${trip.destination}. Plan the itinerary, chat and split costs with fellow travellers on PickAndSync.`).slice(0, 160),
        image: trip.coverImageUrl ? mediaUrl(trip.coverImageUrl) : undefined,
        noindex: !trip.isPublic,
    } : {});
    const [savingAnnouncement, setSavingAnnouncement] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState(emptyEditForm);
    const [savingTrip, setSavingTrip] = useState(false);

    const refreshTrip = async () => {
        const res = await tripsApi.getById(id, inviteCode ? { invite: inviteCode } : undefined);
        setTrip(res.data.data);
        return res.data.data;
    };

    const refreshExpenses = async () => {
        if (!user) return;
        try {
            const [expRes, balRes] = await Promise.all([
                expensesApi.getAll(id),
                expensesApi.getBalances(id),
            ]);
            setExpenses(expRes.data.data);
            setBalances(balRes.data.data || {});
        } catch {
            setExpenses([]);
            setBalances({});
        }
    };

    useEffect(() => {
        (async () => {
            try {
                await refreshTrip();
            } catch {
                navigate('/trips');
            } finally {
                setIsLoading(false);
            }
        })();
    }, [id, navigate]);

    useEffect(() => {
        if (activeTab === 'expenses' && user) refreshExpenses();
    }, [activeTab, user, id]);

    const approvedMembers = useMemo(
        () => trip?.members?.filter((m) => m.status === 'APPROVED') || [],
        [trip]
    );
    const chatMembers = useMemo(() => {
        const list = [...approvedMembers];
        if (trip?.organizer && !list.some((m) => m.userId === trip.organizer.id)) {
            list.unshift({
                userId: trip.organizer.id,
                status: 'APPROVED',
                user: trip.organizer,
            });
        }
        return list;
    }, [approvedMembers, trip]);
    const pendingMembers = useMemo(
        () => trip?.members?.filter((m) => m.status === 'PENDING') || [],
        [trip]
    );
    const myMembership = useMemo(
        () => trip?.members?.find((m) => m.userId === user?.id),
        [trip, user]
    );

    // Finish a join that started before the visitor signed in.
    useEffect(() => {
        if (!user || !trip) return;
        let pending = null;
        try {
            pending = JSON.parse(sessionStorage.getItem(PENDING_JOIN_KEY) || 'null');
        } catch { /* ignore */ }
        if (pending?.tripId !== id) return;
        sessionStorage.removeItem(PENDING_JOIN_KEY);
        if (computeCanJoin(trip, myMembership, user.id)) handleJoin();
    }, [user, trip]);

    const handleShare = async () => {
        if (!trip) return;
        setSharing(true);
        try {
            if (user?.id === trip.organizerId) {
                const res = await tripsApi.createInvite(id);
                await shareLink({
                    title: trip.title,
                    text: `Join my trip "${trip.title}" to ${trip.destination} on PickAndSync — tap to join:`,
                    url: res.data.data.shareUrl,
                });
            } else {
                await shareLink({
                    title: trip.title,
                    text: `Check out this trip to ${trip.destination} on PickAndSync:`,
                    url: trip.shareUrl || `${BACKEND_ORIGIN}/share/trips/${id}`,
                });
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not create the share link.');
        } finally {
            setSharing(false);
        }
    };

    const handleCopyInvite = async (regenerate = false) => {
        if (regenerate && !window.confirm('Reset the invite link? The old link will stop working.')) return;
        try {
            const res = await tripsApi.createInvite(id, regenerate ? { regenerate: true } : {});
            await copyLink(res.data.data.url, regenerate ? 'New invite link copied' : 'Invite link copied');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not create the invite link.');
        }
    };

    const nameById = useMemo(() => {
        const map = {};
        trip?.members?.forEach((m) => {
            if (m.user) map[m.userId] = displayName(m.user.name, m.userId, user?.id);
        });
        if (trip?.organizer) {
            map[trip.organizer.id] = displayName(trip.organizer.name, trip.organizer.id, user?.id);
        }
        return map;
    }, [trip, user?.id]);

    const handleJoin = async () => {
        if (!user) {
            // Sign in without leaving the trip; the join continues after login.
            try {
                sessionStorage.setItem(PENDING_JOIN_KEY, JSON.stringify({ tripId: id }));
            } catch { /* storage blocked */ }
            openAuth(trip?.viaInvite ? 'register' : 'login');
            return;
        }
        setIsJoining(true);
        try {
            const res = await tripsApi.join(id, trip?.viaInvite && inviteCode ? { inviteCode } : {});
            const fresh = await refreshTrip();
            if (res.data?.approved) {
                toast.success("You're in! Say hi in the trip chat.");
                const me = fresh?.members?.find((m) => m.userId === user.id);
                if (me && !me.user?.isVerified) {
                    toast((t) => (
                        <span>
                            Verify your ID so the group sees you as ✓ Verified.{' '}
                            <Link to="/verify" onClick={() => toast.dismiss(t.id)}>Verify now</Link>
                        </span>
                    ), { duration: 8000, id: 'verify-after-invite' });
                }
            } else {
                toast.success('Join request sent! Waiting for organizer approval.');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to join trip.');
        } finally {
            setIsJoining(false);
        }
    };

    const handleLeave = async () => {
        if (!window.confirm(myMembership?.status === 'PENDING'
            ? 'Withdraw your join request?'
            : 'Leave this trip?')) return;
        setIsLeaving(true);
        try {
            await tripsApi.leave(id);
            toast.success(myMembership?.status === 'PENDING' ? 'Join request withdrawn.' : 'You left the trip.');
            await refreshTrip();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not leave trip.');
        } finally {
            setIsLeaving(false);
        }
    };

    const handleMemberStatus = async (userId, status) => {
        if (status === 'LEFT') {
            const name = displayName(
                trip?.members?.find((m) => m.userId === userId)?.user?.name,
                userId,
                user?.id,
                'this member'
            );
            if (!window.confirm(`Remove ${name} from this trip?`)) return;
        }
        try {
            await tripsApi.updateMember(id, userId, { status });
            toast.success(
                status === 'APPROVED'
                    ? 'Member approved.'
                    : status === 'LEFT'
                        ? 'Member removed.'
                        : 'Request declined.'
            );
            await refreshTrip();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not update member.');
        }
    };

    const handleAddExpense = async (e) => {
        e.preventDefault();
        if (!approvedMembers.length) {
            toast.error('Need at least one approved member to split costs.');
            return;
        }
        const amount = Number(expenseForm.amount);
        if (!expenseForm.title.trim() || !(amount > 0)) {
            toast.error('Enter a title and amount.');
            return;
        }

        const share = Math.round((amount / approvedMembers.length) * 100) / 100;
        let allocated = 0;
        const splitWith = approvedMembers.map((m, idx) => {
            if (idx === approvedMembers.length - 1) {
                return { userId: m.userId, amount: Math.round((amount - allocated) * 100) / 100 };
            }
            allocated += share;
            return { userId: m.userId, amount: share };
        });

        setSavingExpense(true);
        try {
            await expensesApi.create(id, {
                title: expenseForm.title.trim(),
                amount,
                currency: 'INR',
                category: expenseForm.category,
                splitWith,
            });
            toast.success('Expense added and split across members.');
            setExpenseForm({ title: '', amount: '', category: 'OTHER' });
            await refreshExpenses();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to add expense.');
        } finally {
            setSavingExpense(false);
        }
    };

    const handleDeleteExpense = async (expenseId) => {
        try {
            await expensesApi.delete(id, expenseId);
            toast.success('Expense removed.');
            await refreshExpenses();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete expense.');
        }
    };

    const handlePostAnnouncement = async (e) => {
        e.preventDefault();
        if (!announcementForm.title.trim() || !announcementForm.content.trim()) {
            toast.error('Enter a title and message.');
            return;
        }
        setSavingAnnouncement(true);
        try {
            await tripsApi.createAnnouncement(id, {
                title: announcementForm.title.trim(),
                content: announcementForm.content.trim(),
                isPinned: announcementForm.isPinned,
            });
            toast.success('Announcement posted. Members were notified.');
            setAnnouncementForm({ title: '', content: '', isPinned: false });
            await refreshTrip();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to post announcement.');
        } finally {
            setSavingAnnouncement(false);
        }
    };

    const handleDeleteAnnouncement = async (announcementId) => {
        if (!window.confirm('Delete this announcement?')) return;
        try {
            await tripsApi.deleteAnnouncement(id, announcementId);
            toast.success('Announcement deleted.');
            await refreshTrip();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete announcement.');
        }
    };

    const openEditTrip = () => {
        if (!trip) return;
        setEditForm({
            title: trip.title || '',
            description: trip.description || '',
            destination: trip.destination || '',
            coverImageUrl: trip.coverImageUrl || '',
            startDate: toInputDate(trip.startDate),
            endDate: toInputDate(trip.endDate),
            maxParticipants: trip.maxParticipants || 6,
            budgetEstimate: trip.budgetEstimate ?? '',
            status: trip.status || 'OPEN',
            isPublic: trip.isPublic !== false,
        });
        setIsEditing(true);
        setActiveTab('overview');
    };

    const handleSaveTrip = async (e) => {
        e.preventDefault();
        if (!editForm.title.trim() || !editForm.destination.trim()) {
            toast.error('Title and destination are required.');
            return;
        }
        if (!editForm.startDate || !editForm.endDate) {
            toast.error('Start and end dates are required.');
            return;
        }
        if (editForm.endDate < editForm.startDate) {
            toast.error('End date must be on or after start date.');
            return;
        }

        setSavingTrip(true);
        try {
            const res = await tripsApi.update(id, {
                title: editForm.title.trim(),
                description: editForm.description.trim() || null,
                destination: editForm.destination.trim(),
                coverImageUrl: editForm.coverImageUrl || null,
                startDate: editForm.startDate,
                endDate: editForm.endDate,
                maxParticipants: Number(editForm.maxParticipants) || 6,
                budgetEstimate: editForm.budgetEstimate === '' ? null : Number(editForm.budgetEstimate),
                status: editForm.status,
                isPublic: editForm.isPublic,
            });
            const changeCount = res.data.changes?.length || 0;
            toast.success(
                changeCount
                    ? `Trip updated. ${changeCount} change${changeCount === 1 ? '' : 's'} — members notified.`
                    : 'No changes to save.'
            );
            setIsEditing(false);
            await refreshTrip();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update trip.');
        } finally {
            setSavingTrip(false);
        }
    };

    if (isLoading) return (
        <div className="trip-detail-loading">
            <div className="skeleton" style={{ height: '320px', borderRadius: 0 }} />
            <div className="container" style={{ paddingTop: 'var(--space-8)' }}>
                <div className="skeleton" style={{ height: '40px', width: '60%', marginBottom: 'var(--space-4)' }} />
                <div className="skeleton" style={{ height: '20px', width: '40%' }} />
            </div>
        </div>
    );

    if (!trip) return null;

    const isOrganizer = user?.id === trip.organizerId;
    const isApprovedMember = myMembership?.status === 'APPROVED' || isOrganizer;
    const canManageExpenses = isApprovedMember;
    const canJoin = computeCanJoin(trip, myMembership, user?.id);
    const canShare = trip.isPublic || isOrganizer;
    const joinedUnverified = myMembership?.status === 'APPROVED' && !isOrganizer && myMembership.user?.isVerified === false;
    const canLeave = !isOrganizer
        && myMembership
        && ['PENDING', 'APPROVED'].includes(myMembership.status);
    const dayGroups = trip.itineraryItems?.reduce((acc, item) => {
        const day = `Day ${item.dayNumber}`;
        if (!acc[day]) acc[day] = [];
        acc[day].push(item);
        return acc;
    }, {});

    const tabs = ['overview', 'itinerary', 'expenses', 'announcements', 'chat'];

    const handlePublish = async () => {
        try {
            await tripsApi.update(id, { status: 'OPEN' });
            toast.success('Trip is now open for others to join.');
            await refreshTrip();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not publish trip.');
        }
    };

    const joinLabel = trip.viaInvite
        ? (user ? 'Join this trip' : 'Sign up to join')
        : (user ? 'Join this trip' : 'Log in to join');
    const joinButton = canJoin && (
        <button className="btn btn-primary w-full join-trip-btn" onClick={handleJoin} disabled={isJoining}>
            {isJoining ? 'Joining…' : joinLabel}
        </button>
    );

    return (
        <div className="trip-detail page-enter">
            <div className="trip-detail-hero">
                {trip.coverImageUrl
                    ? <img src={trip.coverImageUrl} alt={trip.title} className="trip-detail-cover" />
                    : <div className="trip-detail-cover-placeholder">🌍</div>
                }
                <div className="trip-detail-hero-overlay" />
                <div className="container trip-detail-hero-content">
                    <span className={`badge ${STATUS_BADGE[trip.status] || 'badge-neutral'}`}>{trip.status}</span>
                    <h1>{trip.title}</h1>
                    <div className="trip-hero-meta">
                        <span>📍 {trip.destination}</span>
                        {trip.startDate && <span>📅 {format(new Date(trip.startDate), 'MMM d')} – {format(new Date(trip.endDate), 'MMM d, yyyy')}</span>}
                        <span>👥 {approvedMembers.length} / {trip.maxParticipants} members</span>
                        {trip.budgetEstimate && <span>💰 ~₹{trip.budgetEstimate.toLocaleString()} / person</span>}
                    </div>
                </div>
            </div>

            <div className="container trip-detail-body">
                <aside className="trip-detail-sidebar">
                    <div className="card sidebar-card">
                        <h3>Organized by</h3>
                        <Link to={`/profile/${trip.organizer?.id}`} className="organizer-info">
                            {trip.organizer?.avatarUrl
                                ? <img src={trip.organizer.avatarUrl} alt={trip.organizer.name} className="avatar avatar-lg" />
                                : <div className="avatar-placeholder avatar-lg" style={{ fontSize: '1.4rem' }}>{trip.organizer?.name[0]}</div>
                            }
                            <div>
                                <strong className="member-name-row">
                                    {displayName(trip.organizer?.name, trip.organizer?.id, user?.id)}
                                    <span className={`verify-pill ${trip.organizer?.isVerified ? 'is-verified' : 'is-unverified'}`}>
                                        {trip.organizer?.isVerified ? '✓ Verified' : 'Unverified'}
                                    </span>
                                </strong>
                                {trip.organizer?.bio && <p>{trip.organizer.bio.slice(0, 60)}…</p>}
                            </div>
                        </Link>

                        {joinButton}
                        {canLeave && (
                            <button
                                type="button"
                                className="btn btn-ghost w-full"
                                onClick={handleLeave}
                                disabled={isLeaving}
                            >
                                {isLeaving
                                    ? 'Updating…'
                                    : myMembership?.status === 'PENDING'
                                        ? 'Withdraw request'
                                        : 'Leave trip'}
                            </button>
                        )}
                        {!user && canJoin && (
                            <p className="text-muted" style={{ fontSize: '0.85rem', margin: 0 }}>
                                {trip.viaInvite
                                    ? "You've been invited — sign up with your email and you're in."
                                    : 'Create an account or log in, then request to join this trip.'}
                            </p>
                        )}
                        {isOrganizer && (
                            <button
                                type="button"
                                className="btn btn-primary w-full"
                                onClick={openEditTrip}
                            >
                                Edit trip details
                            </button>
                        )}
                        {isOrganizer && trip.status === 'DRAFT' && (
                            <button type="button" className="btn btn-ghost w-full" onClick={handlePublish}>
                                Open trip for joining
                            </button>
                        )}
                        {myMembership?.status === 'PENDING' && (
                            <span className="badge badge-warning">Join request pending</span>
                        )}
                        {myMembership?.status === 'APPROVED' && !isOrganizer && (
                            <span className="badge badge-success">You're in this trip</span>
                        )}
                        {isOrganizer && <span className="badge badge-success">You're the organizer</span>}
                        {user && !isOrganizer && (
                            <Link to={`/reports/new?targetType=TRIP&targetId=${trip.id}`} className="trip-report-link">
                                Report this trip
                            </Link>
                        )}
                        {isOrganizer && (
                            <p className="text-muted" style={{ fontSize: '0.85rem', margin: 0 }}>
                                Changes to price, dates, or member limit notify approved members.
                            </p>
                        )}
                    </div>

                    {joinedUnverified && (
                        <div className="card sidebar-card">
                            <h3>Verify your ID</h3>
                            <p className="text-muted" style={{ fontSize: '0.85rem', margin: 0 }}>
                                You joined with an invite link. Verify once so the group sees you as ✓ Verified — it's also needed to rent cars.
                            </p>
                            <Link to="/verify" className="btn btn-ghost w-full">Verify now</Link>
                        </div>
                    )}

                    {canShare && (
                        <div className="card sidebar-card">
                            <h3>{isOrganizer ? 'Invite friends' : 'Share this trip'}</h3>
                            <p className="text-muted" style={{ fontSize: '0.85rem', margin: 0 }}>
                                {isOrganizer
                                    ? 'Friends with your invite link join instantly — no approval needed.'
                                    : 'Know someone who would love this trip? Send it on WhatsApp.'}
                            </p>
                            <button type="button" className="btn btn-primary w-full" onClick={handleShare} disabled={sharing}>
                                {sharing ? 'Opening…' : 'Share on WhatsApp'}
                            </button>
                            {isOrganizer && (
                                <>
                                    <button type="button" className="btn btn-ghost w-full" onClick={() => handleCopyInvite(false)}>
                                        Copy invite link
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-ghost w-full"
                                        style={{ fontSize: '0.8rem' }}
                                        onClick={() => handleCopyInvite(true)}
                                    >
                                        Reset invite link
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    {isOrganizer && pendingMembers.length > 0 && (
                        <div className="card sidebar-card">
                            <h3>Join requests ({pendingMembers.length})</h3>
                            <div className="members-list">
                                {pendingMembers.map((m) => (
                                    <div key={m.userId} className="pending-member-row">
                                        <div className="member-chip">
                                            {m.user?.avatarUrl
                                                ? <img src={m.user.avatarUrl} alt={m.user.name} className="avatar avatar-sm" />
                                                : <div className="avatar-placeholder avatar-sm" style={{ fontSize: '0.75rem' }}>{m.user?.name?.[0]}</div>
                                            }
                                            <span className="member-name-row">
                                                {displayName(m.user?.name, m.userId, user?.id)}
                                                <span
                                                    className={`verify-pill ${m.user?.isVerified ? 'is-verified' : 'is-unverified'}`}
                                                    title={m.user?.isVerified ? 'Verified' : 'Unverified'}
                                                >
                                                    {m.user?.isVerified ? '✓' : '—'}
                                                </span>
                                            </span>
                                        </div>
                                        <div className="pending-actions">
                                            <button type="button" className="btn btn-primary btn-sm" onClick={() => handleMemberStatus(m.userId, 'APPROVED')}>Approve</button>
                                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleMemberStatus(m.userId, 'REJECTED')}>Decline</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="card sidebar-card">
                        <h3>Members ({approvedMembers.length})</h3>
                        <div className="members-list">
                            {approvedMembers.slice(0, 12).map((m) => {
                                const isSelfOrganizer = m.userId === trip.organizerId;
                                return (
                                    <div key={m.userId} className="member-manage-row">
                                        <Link to={`/profile/${m.userId}`} className="member-chip">
                                            {m.user?.avatarUrl
                                                ? <img src={m.user.avatarUrl} alt={m.user.name} className="avatar avatar-sm" />
                                                : <div className="avatar-placeholder avatar-sm" style={{ fontSize: '0.75rem' }}>{m.user?.name[0]}</div>
                                            }
                                            <span className="member-name-row">
                                                {displayName(m.user?.name, m.userId, user?.id)}
                                                {isSelfOrganizer ? ' (organizer)' : ''}
                                                <span
                                                    className={`verify-pill ${m.user?.isVerified ? 'is-verified' : 'is-unverified'}`}
                                                    title={m.user?.isVerified ? 'Verified' : 'Unverified'}
                                                >
                                                    {m.user?.isVerified ? '✓' : '—'}
                                                </span>
                                            </span>
                                        </Link>
                                        {isOrganizer && !isSelfOrganizer && (
                                            <button
                                                type="button"
                                                className="btn btn-ghost btn-sm member-remove-btn"
                                                onClick={() => handleMemberStatus(m.userId, 'LEFT')}
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                            {approvedMembers.length > 12 && <span className="text-muted">+{approvedMembers.length - 12} more</span>}
                        </div>
                    </div>
                </aside>

                <div className="trip-detail-main">
                    <div className="trip-tabs">
                        {tabs.map((tab) => (
                            <button key={tab} className={`trip-tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                {tab === 'chat' && chatUnreadForTrip > 0 && activeTab !== 'chat' && (
                                    <span className="trip-tab-badge">{chatUnreadForTrip > 99 ? '99+' : chatUnreadForTrip}</span>
                                )}
                            </button>
                        ))}
                    </div>

                    {activeTab === 'overview' && (
                        <div className="tab-content">
                            <h2>About this trip</h2>

                            {isEditing && isOrganizer ? (
                                <form className="trip-edit-form" onSubmit={handleSaveTrip}>
                                    <p className="text-muted trip-edit-intro">
                                        Update trip details. Approved members get an in-app notification for every saved change.
                                    </p>
                                    <label>
                                        Title
                                        <input
                                            type="text"
                                            value={editForm.title}
                                            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                            required
                                            maxLength={120}
                                        />
                                    </label>
                                    <label>
                                        Destination
                                        <LocationAutocomplete
                                            value={editForm.destination}
                                            onChange={(value) => setEditForm({
                                                ...editForm,
                                                destination: value,
                                                coverImageUrl: '',
                                            })}
                                            placeholder="City or region"
                                        />
                                    </label>
                                    <CoverImagePicker
                                        place={editForm.destination}
                                        value={editForm.coverImageUrl}
                                        onChange={(url) => setEditForm({ ...editForm, coverImageUrl: url })}
                                    />
                                    <label>
                                        Description
                                        <textarea
                                            rows={4}
                                            value={editForm.description}
                                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                            placeholder="Plan, vibe, what you’ll split…"
                                        />
                                    </label>
                                    <div className="trip-edit-row">
                                        <label>
                                            Start date
                                            <input
                                                type="date"
                                                value={editForm.startDate}
                                                onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                                                required
                                            />
                                        </label>
                                        <label>
                                            End date
                                            <input
                                                type="date"
                                                value={editForm.endDate}
                                                onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                                                required
                                            />
                                        </label>
                                    </div>
                                    <div className="trip-edit-row">
                                        <label>
                                            Member limit
                                            <input
                                                type="number"
                                                min={Math.max(2, approvedMembers.length)}
                                                max={50}
                                                value={editForm.maxParticipants}
                                                onChange={(e) => setEditForm({ ...editForm, maxParticipants: e.target.value })}
                                                required
                                            />
                                        </label>
                                        <label>
                                            Budget / person (₹)
                                            <input
                                                type="number"
                                                min="0"
                                                step="100"
                                                value={editForm.budgetEstimate}
                                                onChange={(e) => setEditForm({ ...editForm, budgetEstimate: e.target.value })}
                                                placeholder="e.g. 6500"
                                            />
                                        </label>
                                    </div>
                                    <div className="trip-edit-row">
                                        <label>
                                            Status
                                            <select
                                                value={editForm.status}
                                                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                                            >
                                                <option value="DRAFT">Draft</option>
                                                <option value="OPEN">Open</option>
                                                <option value="FULL">Full</option>
                                                <option value="IN_PROGRESS">In progress</option>
                                                <option value="COMPLETED">Completed</option>
                                                <option value="CANCELLED">Cancelled</option>
                                            </select>
                                        </label>
                                        <label className="trip-edit-check">
                                            <span>Visibility</span>
                                            <span className="trip-edit-check-row">
                                                <input
                                                    type="checkbox"
                                                    checked={editForm.isPublic}
                                                    onChange={(e) => setEditForm({ ...editForm, isPublic: e.target.checked })}
                                                />
                                                Public listing
                                            </span>
                                        </label>
                                    </div>
                                    <div className="trip-edit-actions">
                                        <button type="submit" className="btn btn-primary" disabled={savingTrip}>
                                            {savingTrip ? 'Saving…' : 'Save changes'}
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-ghost"
                                            disabled={savingTrip}
                                            onClick={() => setIsEditing(false)}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <>
                            <p className="trip-description">{trip.description || 'No description provided.'}</p>
                            {canJoin && (
                                <div className="join-banner card">
                                    <div>
                                        <strong>{trip.viaInvite ? "You're invited!" : 'Want to travel together?'}</strong>
                                        <p className="text-muted" style={{ margin: '0.35rem 0 0' }}>
                                            {trip.viaInvite
                                                ? 'Join instantly with your invite, then plan, chat and split costs with the group.'
                                                : 'Request to join — the organizer will approve you, then you can split shared costs.'}
                                        </p>
                                    </div>
                                    <button className="btn btn-primary join-trip-btn" onClick={handleJoin} disabled={isJoining}>
                                        {isJoining ? 'Joining…' : joinLabel}
                                    </button>
                                </div>
                            )}
                            <p className="text-muted" style={{ marginTop: '1rem' }}>
                                Travel together: one person posts the trip, others join, and shared costs are split on the Expenses tab.
                            </p>

                            <TripCarSuggestions
                                tripId={trip.id}
                                destination={trip.destination}
                                startDate={toInputDate(trip.startDate)}
                                endDate={toInputDate(trip.endDate)}
                                seats={trip.maxParticipants}
                                title={isOrganizer ? 'Cars for your trip' : 'Cars that fit this trip'}
                            />
                                </>
                            )}
                        </div>
                    )}

                    {activeTab === 'itinerary' && (
                        <div className="tab-content">
                            <h2>Itinerary</h2>
                            {!dayGroups || Object.keys(dayGroups).length === 0
                                ? <p className="text-muted">No itinerary items yet.</p>
                                : Object.entries(dayGroups).map(([day, items]) => (
                                    <div key={day} className="itinerary-day">
                                        <h3 className="day-label">{day}</h3>
                                        <div className="itinerary-items">
                                            {items.map((item) => (
                                                <div key={item.id} className="itinerary-item card">
                                                    <div className="itinerary-item-time">{item.startTime || '—'}</div>
                                                    <div className="itinerary-item-content">
                                                        <strong>{item.title}</strong>
                                                        {item.location && <span>📍 {item.location}</span>}
                                                        {item.description && <p>{item.description}</p>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            }
                        </div>
                    )}

                    {activeTab === 'expenses' && (
                        <div className="tab-content">
                            <h2>Split the money</h2>
                            {!user ? (
                                <p className="text-muted">Log in to view and add shared expenses.</p>
                            ) : !canManageExpenses ? (
                                <p className="text-muted">Join this trip (and get approved) to split expenses with the group.</p>
                            ) : (
                                <>
                                    <form className="expense-form" onSubmit={handleAddExpense}>
                                        <input
                                            type="text"
                                            placeholder="What was paid? e.g. Fuel, Hotel"
                                            value={expenseForm.title}
                                            onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
                                            required
                                        />
                                        <input
                                            type="number"
                                            min="1"
                                            step="0.01"
                                            placeholder="Amount (₹)"
                                            value={expenseForm.amount}
                                            onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                                            required
                                        />
                                        <select
                                            value={expenseForm.category}
                                            onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                                        >
                                            <option value="TRANSPORT">Transport</option>
                                            <option value="ACCOMMODATION">Stay</option>
                                            <option value="FOOD">Food</option>
                                            <option value="ACTIVITY">Activity</option>
                                            <option value="OTHER">Other</option>
                                        </select>
                                        <button type="submit" className="btn btn-primary" disabled={savingExpense}>
                                            {savingExpense ? 'Saving…' : 'Add & split equally'}
                                        </button>
                                    </form>
                                    <p className="text-muted expense-hint">
                                        Split equally across {approvedMembers.length} approved member{approvedMembers.length === 1 ? '' : 's'}. You are marked as the payer.
                                    </p>

                                    {Object.keys(balances).length > 0 && (
                                        <div className="balances-card card">
                                            <h3>Balances</h3>
                                            <ul className="balances-list">
                                                {Object.entries(balances).map(([uid, net]) => (
                                                    <li key={uid}>
                                                        <span>{nameById[uid] || 'Member'}</span>
                                                        <strong className={net >= 0 ? 'bal-pos' : 'bal-neg'}>
                                                            {net >= 0 ? `+₹${net.toFixed(0)}` : `−₹${Math.abs(net).toFixed(0)}`}
                                                        </strong>
                                                    </li>
                                                ))}
                                            </ul>
                                            <p className="text-muted" style={{ fontSize: '0.8rem', margin: '0.5rem 0 0' }}>
                                                Positive = others owe them. Negative = they owe the group.
                                            </p>
                                        </div>
                                    )}

                                    <div className="expense-list">
                                        {expenses.length === 0 ? (
                                            <p className="text-muted">No shared expenses yet. Add fuel, food, or stay costs to split.</p>
                                        ) : expenses.map((exp) => (
                                            <div key={exp.id} className="expense-item card">
                                                <div>
                                                    <strong>{exp.title}</strong>
                                                    <p className="text-muted">
                                                        Paid by {displayName(exp.payer?.name, exp.payerId || exp.payer?.id, user?.id, 'Someone')} · {format(new Date(exp.date || exp.createdAt), 'MMM d, yyyy')}
                                                        {exp.category ? ` · ${exp.category}` : ''}
                                                    </p>
                                                </div>
                                                <div className="expense-item-side">
                                                    <strong>₹{Number(exp.amount).toLocaleString()}</strong>
                                                    {(exp.payerId === user.id || isOrganizer) && (
                                                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDeleteExpense(exp.id)}>
                                                            Delete
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {activeTab === 'announcements' && (
                        <div className="tab-content">
                            <h2>Announcements</h2>
                            <p className="text-muted" style={{ marginTop: 0 }}>
                                {isOrganizer
                                    ? 'Post updates for the group — approved members get an in-app notification.'
                                    : 'Updates from the trip organizer.'}
                            </p>

                            {isOrganizer && (
                                <form className="announcement-form" onSubmit={handlePostAnnouncement}>
                                    <input
                                        type="text"
                                        placeholder="Title — e.g. Pickup point updated"
                                        value={announcementForm.title}
                                        onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                                        maxLength={120}
                                        required
                                    />
                                    <textarea
                                        placeholder="Message for the group…"
                                        value={announcementForm.content}
                                        onChange={(e) => setAnnouncementForm({ ...announcementForm, content: e.target.value })}
                                        rows={4}
                                        required
                                    />
                                    <div className="announcement-form-actions">
                                        <label className="announcement-pin">
                                            <input
                                                type="checkbox"
                                                checked={announcementForm.isPinned}
                                                onChange={(e) => setAnnouncementForm({ ...announcementForm, isPinned: e.target.checked })}
                                            />
                                            Pin to top
                                        </label>
                                        <button type="submit" className="btn btn-primary" disabled={savingAnnouncement}>
                                            {savingAnnouncement ? 'Posting…' : 'Post announcement'}
                                        </button>
                                    </div>
                                </form>
                            )}

                            {!trip.announcements?.length
                                ? <p className="text-muted">{isOrganizer ? 'No announcements yet — post the first update above.' : 'No announcements yet.'}</p>
                                : trip.announcements.map((a) => (
                                    <div key={a.id} className={`announcement card ${a.isPinned ? 'pinned' : ''}`}>
                                        <div className="flex justify-between items-center" style={{ gap: '0.75rem' }}>
                                            <strong>
                                                {a.isPinned && <span className="announcement-pinned-label">Pinned</span>}
                                                {a.title}
                                            </strong>
                                            <span className="text-muted" style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                                {format(new Date(a.createdAt), 'MMM d, yyyy')}
                                            </span>
                                        </div>
                                        <p>{a.content}</p>
                                        <div className="announcement-meta">
                                            <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                                                {a.author?.name || 'Organizer'}
                                            </span>
                                            {isOrganizer && (
                                                <button
                                                    type="button"
                                                    className="btn btn-ghost btn-sm"
                                                    onClick={() => handleDeleteAnnouncement(a.id)}
                                                >
                                                    Delete
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            }
                        </div>
                    )}

                    {activeTab === 'chat' && (
                        <div className="tab-content">
                            <TripChat tripId={id} user={user} canChat={isApprovedMember} members={chatMembers} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
