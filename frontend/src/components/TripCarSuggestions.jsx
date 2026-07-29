import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { rentalsApi, tripsApi } from '../api/index.js';
import './TripCarSuggestions.css';

const FALLBACK =
    'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=400&q=70';

/**
 * Suggests rental cars matched to trip destination, dates, and group size.
 * Pass either tripId OR { destination, startDate, endDate, seats }.
 */
export default function TripCarSuggestions({
    tripId = null,
    destination = '',
    startDate = '',
    endDate = '',
    seats = 4,
    title = 'Cars for this trip',
    compact = false,
}) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            if (tripId) {
                setLoading(true);
                setError('');
                try {
                    const res = await tripsApi.getCarSuggestions(tripId);
                    if (!cancelled) setItems(res.data.data || []);
                } catch (err) {
                    if (!cancelled) {
                        setItems([]);
                        setError(err.response?.data?.message || 'Could not load car suggestions.');
                    }
                } finally {
                    if (!cancelled) setLoading(false);
                }
                return;
            }

            if (!destination?.trim() || !startDate || !endDate || endDate < startDate) {
                setItems([]);
                return;
            }

            setLoading(true);
            setError('');
            try {
                const res = await rentalsApi.getSuggestions({
                    destination: destination.trim(),
                    startDate,
                    endDate,
                    seats,
                    limit: 6,
                });
                if (!cancelled) setItems(res.data.data || []);
            } catch (err) {
                if (!cancelled) {
                    setItems([]);
                    setError(err.response?.data?.message || 'Could not load car suggestions.');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => { cancelled = true; };
    }, [tripId, destination, startDate, endDate, seats]);

    if (!tripId && (!destination?.trim() || !startDate || !endDate)) return null;

    return (
        <section className={`trip-cars ${compact ? 'compact' : ''}`}>
            <div className="trip-cars-head">
                <div>
                    <h3>{title}</h3>
                    <p>Matched by destination, dates, and seats from Car on Rent.</p>
                </div>
                <Link to="/rentals" className="trip-cars-browse">Browse all</Link>
            </div>

            {loading && <p className="trip-cars-muted">Finding cars…</p>}
            {!loading && error && <p className="trip-cars-error">{error}</p>}
            {!loading && !error && items.length === 0 && (
                <p className="trip-cars-muted">
                    No verified cars free for these dates yet. Publish the trip anyway — you can rent later from Car on Rent.
                </p>
            )}

            {!loading && items.length > 0 && (
                <div className="trip-cars-grid">
                    {items.map((listing) => {
                        const v = listing.vehicle;
                        const name = v ? `${v.make} ${v.model}` : 'Vehicle';
                        const thumb = v?.images?.[0] || FALLBACK;
                        const bookHref = `/rentals?listing=${listing.id}&start=${startDate || ''}&end=${endDate || ''}`;
                        return (
                            <article key={listing.id} className="trip-car-card">
                                <img src={thumb} alt={name} className="trip-car-thumb" />
                                <div className="trip-car-body">
                                    <h4>{name}</h4>
                                    <p className="trip-car-loc">{listing.location}</p>
                                    <ul className="trip-car-reasons">
                                        {(listing.matchReasons || []).map((r) => (
                                            <li key={r}>{r}</li>
                                        ))}
                                    </ul>
                                    <div className="trip-car-foot">
                                        <strong>
                                            ₹{Number(listing.pricePerDay).toLocaleString()}
                                            <span>/day</span>
                                        </strong>
                                        {listing.estimatedTotal != null && (
                                            <span className="trip-car-total">
                                                ~₹{Number(listing.estimatedTotal).toLocaleString()} trip
                                            </span>
                                        )}
                                    </div>
                                    <Link to={bookHref} className="trip-car-cta">
                                        View & book
                                    </Link>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </section>
    );
}
