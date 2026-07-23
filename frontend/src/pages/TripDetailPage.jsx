import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { tripsApi, expensesApi } from '../api/index.js';
import { useAuthStore } from '../store/authStore.js';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import './TripDetailPage.css';

const STATUS_BADGE = { OPEN: 'badge-success', FULL: 'badge-warning', IN_PROGRESS: 'badge-info', COMPLETED: 'badge-neutral', DRAFT: 'badge-neutral' };

export default function TripDetailPage() {
    const { id } = useParams();
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const [trip, setTrip] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isJoining, setIsJoining] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');
    const [expenses, setExpenses] = useState([]);
    const [balances, setBalances] = useState({});
    const [expenseForm, setExpenseForm] = useState({ title: '', amount: '', category: 'OTHER' });
    const [savingExpense, setSavingExpense] = useState(false);

    const refreshTrip = async () => {
        const res = await tripsApi.getById(id);
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
    const pendingMembers = useMemo(
        () => trip?.members?.filter((m) => m.status === 'PENDING') || [],
        [trip]
    );
    const myMembership = useMemo(
        () => trip?.members?.find((m) => m.userId === user?.id),
        [trip, user]
    );

    const nameById = useMemo(() => {
        const map = {};
        trip?.members?.forEach((m) => {
            if (m.user) map[m.userId] = m.user.name;
        });
        if (trip?.organizer) map[trip.organizer.id] = trip.organizer.name;
        return map;
    }, [trip]);

    const handleJoin = async () => {
        if (!user) return navigate('/login');
        setIsJoining(true);
        try {
            await tripsApi.join(id);
            toast.success('Join request sent! Waiting for organizer approval.');
            await refreshTrip();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to join trip.');
        } finally {
            setIsJoining(false);
        }
    };

    const handleMemberStatus = async (userId, status) => {
        try {
            await tripsApi.updateMember(id, userId, { status });
            toast.success(status === 'APPROVED' ? 'Member approved.' : 'Request declined.');
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
    const canJoin = !isOrganizer
        && (!myMembership || myMembership.status === 'REJECTED')
        && ['OPEN', 'DRAFT'].includes(trip.status);
    const dayGroups = trip.itineraryItems?.reduce((acc, item) => {
        const day = `Day ${item.dayNumber}`;
        if (!acc[day]) acc[day] = [];
        acc[day].push(item);
        return acc;
    }, {});

    const tabs = ['overview', 'itinerary', 'expenses', 'announcements'];

    const handlePublish = async () => {
        try {
            await tripsApi.update(id, { status: 'OPEN' });
            toast.success('Trip is now open for others to join.');
            await refreshTrip();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not publish trip.');
        }
    };

    const joinButton = canJoin && (
        <button className="btn btn-primary w-full join-trip-btn" onClick={handleJoin} disabled={isJoining}>
            {isJoining ? 'Sending request…' : (user ? 'Join this trip' : 'Log in to join')}
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
                                <strong>{trip.organizer?.name}</strong>
                                {trip.organizer?.bio && <p>{trip.organizer.bio.slice(0, 60)}…</p>}
                            </div>
                        </Link>

                        {joinButton}
                        {!user && canJoin && (
                            <p className="text-muted" style={{ fontSize: '0.85rem', margin: 0 }}>
                                Create an account or log in, then request to join this trip.
                            </p>
                        )}
                        {isOrganizer && trip.status === 'DRAFT' && (
                            <button type="button" className="btn btn-primary w-full" onClick={handlePublish}>
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
                        {isOrganizer && (
                            <p className="text-muted" style={{ fontSize: '0.85rem', margin: 0 }}>
                                Others will see a Join button on this trip. Log in with a different account to test joining.
                            </p>
                        )}
                    </div>

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
                                            <span>{m.user?.name}</span>
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
                            {approvedMembers.slice(0, 8).map((m) => (
                                <Link key={m.userId} to={`/profile/${m.userId}`} className="member-chip">
                                    {m.user?.avatarUrl
                                        ? <img src={m.user.avatarUrl} alt={m.user.name} className="avatar avatar-sm" />
                                        : <div className="avatar-placeholder avatar-sm" style={{ fontSize: '0.75rem' }}>{m.user?.name[0]}</div>
                                    }
                                    <span>{m.user?.name}</span>
                                </Link>
                            ))}
                            {approvedMembers.length > 8 && <span className="text-muted">+{approvedMembers.length - 8} more</span>}
                        </div>
                    </div>
                </aside>

                <div className="trip-detail-main">
                    <div className="trip-tabs">
                        {tabs.map((tab) => (
                            <button key={tab} className={`trip-tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}
                    </div>

                    {activeTab === 'overview' && (
                        <div className="tab-content">
                            <h2>About this trip</h2>
                            <p className="trip-description">{trip.description || 'No description provided.'}</p>
                            {canJoin && (
                                <div className="join-banner card">
                                    <div>
                                        <strong>Want to travel together?</strong>
                                        <p className="text-muted" style={{ margin: '0.35rem 0 0' }}>
                                            Request to join — the organizer will approve you, then you can split shared costs.
                                        </p>
                                    </div>
                                    <button className="btn btn-primary join-trip-btn" onClick={handleJoin} disabled={isJoining}>
                                        {isJoining ? 'Sending request…' : (user ? 'Join this trip' : 'Log in to join')}
                                    </button>
                                </div>
                            )}
                            <p className="text-muted" style={{ marginTop: '1rem' }}>
                                Travel together: one person posts the trip, others join, and shared costs are split on the Expenses tab.
                            </p>
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
                                                        Paid by {exp.payer?.name || 'Someone'} · {format(new Date(exp.date || exp.createdAt), 'MMM d, yyyy')}
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
                            {!trip.announcements?.length
                                ? <p className="text-muted">No announcements yet.</p>
                                : trip.announcements.map((a) => (
                                    <div key={a.id} className="announcement card">
                                        <div className="flex justify-between items-center">
                                            <strong>{a.title}</strong>
                                            <span className="text-muted" style={{ fontSize: '0.8rem' }}>{format(new Date(a.createdAt), 'MMM d, yyyy')}</span>
                                        </div>
                                        <p>{a.content}</p>
                                    </div>
                                ))
                            }
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
