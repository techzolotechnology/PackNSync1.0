import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { rentalsApi } from '../api/index.js';
import { useAuthStore } from '../store/authStore.js';
import './MyBookingsPage.css';

const statusClass = (status) => {
    const s = (status || '').toLowerCase();
    if (s.includes('confirm') || s.includes('complete')) return 'status-ok';
    if (s.includes('cancel') || s.includes('reject')) return 'status-bad';
    return 'status-pending';
};

export default function MyBookingsPage() {
    const user = useAuthStore((s) => s.user);
    const [tab, setTab] = useState('rentals');
    const [myRentals, setMyRentals] = useState([]);
    const [hostRentals, setHostRentals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!user) return;
        fetchAll();
    }, [user]);

    const fetchAll = async () => {
        setLoading(true);
        setMessage('');
        try {
            const [renterRes, hostRes] = await Promise.all([
                rentalsApi.getMyBookings(),
                rentalsApi.getHostBookings(),
            ]);
            setMyRentals(renterRes.data.data);
            setHostRentals(hostRes.data.data);
        } catch (err) {
            setMessage(err.response?.data?.message || 'Unable to load bookings.');
        } finally {
            setLoading(false);
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
                    <p>Rental requests you made and bookings on cars you host.</p>
                </div>
                <Link to="/rentals" className="btn btn-primary btn-sm">Browse rentals</Link>
            </header>

            <div className="bookings-tabs">
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
            ) : tab === 'rentals' ? (
                myRentals.length === 0 ? (
                    <div className="bookings-empty">
                        <h3>No rental bookings yet</h3>
                        <p>Search self-drive cars and send a booking request.</p>
                        <Link to="/rentals" className="btn btn-primary">Find a car</Link>
                    </div>
                ) : (
                    <div className="bookings-list">
                        {myRentals.map((b) => (
                            <article key={b.id} className="booking-item">
                                <div>
                                    <h3>{b.listing.vehicle.make} {b.listing.vehicle.model}</h3>
                                    <p>{b.listing.location} • Host: {b.listing.host?.name}</p>
                                    <p className="booking-dates">
                                        {new Date(b.startDate).toLocaleDateString()} → {new Date(b.endDate).toLocaleDateString()}
                                    </p>
                                </div>
                                <div className="booking-side">
                                    <strong>₹{b.totalPrice}</strong>
                                    <span className={`booking-status ${statusClass(b.status)}`}>{b.status}</span>
                                </div>
                            </article>
                        ))}
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
                                <p>Renter: {b.renter.name}{b.renter.email ? ` • ${b.renter.email}` : ''}</p>
                                <p className="booking-dates">
                                    {new Date(b.startDate).toLocaleDateString()} → {new Date(b.endDate).toLocaleDateString()}
                                </p>
                            </div>
                            <div className="booking-side">
                                <strong>₹{b.totalPrice}</strong>
                                <span className={`booking-status ${statusClass(b.status)}`}>{b.status}</span>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </div>
    );
}
