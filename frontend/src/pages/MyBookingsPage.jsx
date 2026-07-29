import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { rentalsApi, usersApi } from '../api/index.js';
import { useAuthStore } from '../store/authStore.js';
import { displayName } from '../utils/displayName.js';
import './MyBookingsPage.css';

const statusClass = (status) => {
    const s = (status || '').toUpperCase();
    if (s === 'PAID' || s === 'CONFIRMED' || s === 'COMPLETED' || s === 'OPEN' || s === 'IN_PROGRESS') return 'status-ok';
    if (s === 'CANCELLED' || s === 'REJECTED') return 'status-bad';
    return 'status-pending';
};

export default function MyBookingsPage() {
    const user = useAuthStore((s) => s.user);
    const [tab, setTab] = useState('trips');
    const [myTrips, setMyTrips] = useState([]);
    const [myRentals, setMyRentals] = useState([]);
    const [hostRentals, setHostRentals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [busyId, setBusyId] = useState(null);

    useEffect(() => {
        if (!user) return;
        fetchAll();
    }, [user]);

    const fetchAll = async () => {
        setLoading(true);
        setMessage('');
        try {
            const [tripsRes, renterRes, hostRes] = await Promise.all([
                usersApi.getTrips(user.id),
                rentalsApi.getMyBookings(),
                rentalsApi.getHostBookings(),
            ]);
            setMyTrips(tripsRes.data.data || []);
            setMyRentals(renterRes.data.data || []);
            setHostRentals(hostRes.data.data || []);
        } catch (err) {
            setMessage(err.response?.data?.message || 'Unable to load bookings.');
        } finally {
            setLoading(false);
        }
    };

    const runAction = async (id, action, successMsg) => {
        setBusyId(id);
        try {
            await action();
            toast.success(successMsg);
            await fetchAll();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Action failed.');
        } finally {
            setBusyId(null);
        }
    };

    if (!user) {
        return (
            <div className="bookings-page">
                <p>Please <Link to="/login">log in</Link> to view your bookings.</p>
            </div>
        );
    }

    return (
        <div className="bookings-page">
            <header className="bookings-header">
                <div>
                    <h1>My Bookings</h1>
                    <p>Trips you joined, rental requests, and bookings you host.</p>
                </div>
                <div className="bookings-header-actions">
                    <Link to="/trips" className="btn btn-ghost btn-sm">Browse trips</Link>
                    <Link to="/rentals" className="btn btn-primary btn-sm">Browse rentals</Link>
                </div>
            </header>

            <div className="bookings-tabs">
                <button type="button" className={tab === 'trips' ? 'active' : ''} onClick={() => setTab('trips')}>
                    My trips ({myTrips.length})
                </button>
                <button type="button" className={tab === 'rentals' ? 'active' : ''} onClick={() => setTab('rentals')}>
                    My rentals ({myRentals.length})
                </button>
                <button type="button" className={tab === 'host' ? 'active' : ''} onClick={() => setTab('host')}>
                    As host ({hostRentals.length})
                </button>
            </div>

            {message && <div className="bookings-message">{message}</div>}

            {loading ? (
                <div className="bookings-loading">Loading bookings…</div>
            ) : tab === 'trips' ? (
                myTrips.length === 0 ? (
                    <div className="bookings-empty">
                        <h3>No trips yet</h3>
                        <p>Join a Travel Together trip, or post your own.</p>
                        <Link to="/trips" className="btn btn-primary">Find a trip</Link>
                    </div>
                ) : (
                    <div className="bookings-list">
                        {myTrips.map((trip) => {
                            const role = trip.organizerId === user.id ? 'Organizer' : 'Joined';
                            return (
                                <article key={trip.id} className="booking-item">
                                    <div className="booking-trip-main">
                                        {trip.coverImageUrl && (
                                            <img src={trip.coverImageUrl} alt="" className="booking-trip-thumb" />
                                        )}
                                        <div>
                                            <h3>{trip.title}</h3>
                                            <p>{trip.destination}</p>
                                            <p className="booking-dates">
                                                {trip.startDate && trip.endDate
                                                    ? `${format(new Date(trip.startDate), 'MMM d')} → ${format(new Date(trip.endDate), 'MMM d, yyyy')}`
                                                    : 'Dates TBD'}
                                            </p>
                                            <p className="booking-hint">
                                                {role === 'Organizer'
                                                    ? 'You organize this trip'
                                                    : `Organizer: ${trip.organizer?.name || 'Host'}`}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="booking-side">
                                        <span className={`booking-status ${role === 'Organizer' ? 'status-ok' : 'status-pending'}`}>
                                            {role}
                                        </span>
                                        <span className={`booking-status ${statusClass(trip.status)}`}>
                                            {trip.status}
                                        </span>
                                        <Link to={`/trips/${trip.id}`} className="btn btn-primary btn-sm">
                                            Open trip
                                        </Link>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )
            ) : tab === 'rentals' ? (
                myRentals.length === 0 ? (
                    <div className="bookings-empty">
                        <h3>No rental bookings yet</h3>
                        <p>Search self-drive cars and send a booking request.</p>
                        <Link to="/rentals" className="btn btn-primary">Find a car</Link>
                    </div>
                ) : (
                    <div className="bookings-list">
                        {myRentals.map((b) => {
                            const canCancel = ['PENDING', 'CONFIRMED'].includes(b.status);
                            const canPay = b.status === 'CONFIRMED';
                            const hostLabel = displayName(b.listing.host?.name, b.listing.host?.id || b.listing.hostId, user.id, 'Host');
                            return (
                                <article key={b.id} className="booking-item">
                                    <div>
                                        <h3>{b.listing.vehicle.make} {b.listing.vehicle.model}</h3>
                                        <p>{b.listing.location} • Host: {hostLabel}</p>
                                        <p className="booking-dates">
                                            {new Date(b.startDate).toLocaleDateString()} → {new Date(b.endDate).toLocaleDateString()}
                                        </p>
                                        {b.status === 'PENDING' && (
                                            <p className="booking-hint">Waiting for host confirmation before payment.</p>
                                        )}
                                        {b.status === 'CONFIRMED' && (
                                            <p className="booking-hint">Host confirmed — pay to lock in the booking.</p>
                                        )}
                                    </div>
                                    <div className="booking-side">
                                        <strong>₹{Number(b.totalPrice).toLocaleString()}</strong>
                                        <span className={`booking-status ${statusClass(b.status)}`}>{b.status}</span>
                                        <div className="booking-actions">
                                            {canPay && (
                                                <button
                                                    type="button"
                                                    className="btn btn-primary btn-sm"
                                                    disabled={busyId === b.id}
                                                    onClick={() => runAction(b.id, () => rentalsApi.payBooking(b.id), 'Payment successful.')}
                                                >
                                                    {busyId === b.id ? 'Paying…' : 'Pay now'}
                                                </button>
                                            )}
                                            {canCancel && (
                                                <button
                                                    type="button"
                                                    className="btn btn-ghost btn-sm"
                                                    disabled={busyId === b.id}
                                                    onClick={() => {
                                                        if (!window.confirm('Cancel this booking request?')) return;
                                                        runAction(b.id, () => rentalsApi.cancelBooking(b.id), 'Booking cancelled.');
                                                    }}
                                                >
                                                    Cancel
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )
            ) : hostRentals.length === 0 ? (
                <div className="bookings-empty">
                    <h3>No incoming requests</h3>
                    <p>List a vehicle on the host dashboard to receive bookings.</p>
                    <Link to="/host" className="btn btn-primary">Host dashboard</Link>
                </div>
            ) : (
                <div className="bookings-list">
                    {hostRentals.map((b) => (
                        <article key={b.id} className="booking-item">
                            <div>
                                <h3>{b.listing.vehicle.make} {b.listing.vehicle.model}</h3>
                                <p>
                                    Renter: {displayName(b.renter?.name, b.renter?.id || b.renterId, user.id)}
                                    {b.renter?.email ? ` • ${b.renter.email}` : ''}
                                </p>
                                <p className="booking-dates">
                                    {new Date(b.startDate).toLocaleDateString()} → {new Date(b.endDate).toLocaleDateString()}
                                </p>
                            </div>
                            <div className="booking-side">
                                <strong>₹{Number(b.totalPrice).toLocaleString()}</strong>
                                <span className={`booking-status ${statusClass(b.status)}`}>{b.status}</span>
                                {b.status === 'PENDING' && (
                                    <div className="booking-actions">
                                        <button
                                            type="button"
                                            className="btn btn-primary btn-sm"
                                            disabled={busyId === b.id}
                                            onClick={() => runAction(
                                                b.id,
                                                () => rentalsApi.respondToBooking(b.id, 'CONFIRMED'),
                                                'Booking confirmed.'
                                            )}
                                        >
                                            Confirm
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-ghost btn-sm"
                                            disabled={busyId === b.id}
                                            onClick={() => runAction(
                                                b.id,
                                                () => rentalsApi.respondToBooking(b.id, 'REJECTED'),
                                                'Booking declined.'
                                            )}
                                        >
                                            Reject
                                        </button>
                                    </div>
                                )}
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </div>
    );
}
