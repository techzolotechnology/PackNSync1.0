import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { tripsApi } from '../api/index.js';
import useSeo from '../hooks/useSeo.js';
import { canonicalUrl } from '../seo/seoConfig.js';
import { DESTINATIONS, destinationJsonLd, destinationSeo, findDestination } from '../seo/destinations.js';
import { mediaUrl } from '../utils/mediaUrl.js';
import './Destinations.css';

const fmtDate = (value) => {
    try {
        return format(new Date(value), 'd MMM yyyy');
    } catch {
        return '';
    }
};

/** /destinations/:slug — landing page for one international destination. */
export default function DestinationPage() {
    const { slug } = useParams();
    const destination = findDestination(slug);
    const [trips, setTrips] = useState([]);
    const [loadingTrips, setLoadingTrips] = useState(true);

    const jsonLd = useMemo(
        () => (destination ? destinationJsonLd(destination, canonicalUrl(`destinations/${destination.slug}`)) : null),
        [destination],
    );
    useSeo(destination ? {
        ...destinationSeo(destination),
        path: `destinations/${destination.slug}`,
        jsonLd,
    } : {});

    useEffect(() => {
        if (!destination) return undefined;
        let cancelled = false;
        setLoadingTrips(true);
        tripsApi.getAll({ search: destination.searchTerm, limit: 6 })
            .then((res) => { if (!cancelled) setTrips(res.data?.data || []); })
            .catch(() => { if (!cancelled) setTrips([]); })
            .finally(() => { if (!cancelled) setLoadingTrips(false); });
        return () => { cancelled = true; };
    }, [destination]);

    if (!destination) return <Navigate to="/destinations/" replace />;

    const q = encodeURIComponent(destination.searchTerm);
    const others = DESTINATIONS.filter((d) => d.slug !== destination.slug && d.region === destination.region).slice(0, 4);

    return (
        <div className="dst-page page-atmosphere page-enter">
            <div className="container">
                <nav className="dst-crumbs" aria-label="Breadcrumb">
                    <Link to="/destinations/">Destinations</Link> <span aria-hidden="true">/</span> {destination.name}
                </nav>

                <header className="dst-hero">
                    <div className="dst-hero-text">
                        <p className="dst-kicker">{destination.region} · {destination.country}</p>
                        <h1>{destination.name} Group Trip: Travel Together with Friends</h1>
                        <p className="dst-lead">{destination.intro}</p>
                        <div className="dst-actions">
                            <Link className="btn btn-primary" to={`/explore?mode=planner&destination=${q}`}>
                                Plan with AI trip planner
                            </Link>
                            <Link className="btn btn-ghost" to={`/trips/create?destination=${q}`}>
                                Post a {destination.name} trip
                            </Link>
                        </div>
                    </div>
                    <img className="dst-hero-img" src={destination.image} alt={`${destination.name} travel`} />
                </header>

                <section className="dst-facts" aria-label="Trip facts">
                    <div><span>Best time to visit</span><strong>{destination.bestTime}</strong></div>
                    <div><span>Ideal trip length</span><strong>{destination.idealDays}</strong></div>
                    <div><span>Visa</span><strong>Check current rules for Indian passports before booking</strong></div>
                </section>

                <section className="dst-section">
                    <h2>Top things to do in {destination.name} together</h2>
                    <ul className="dst-highlights">
                        {destination.highlights.map((h) => <li key={h}>{h}</li>)}
                    </ul>
                    <p className="dst-tip"><strong>Group tip:</strong> {destination.groupTip}</p>
                </section>

                <section className="dst-section">
                    <h2>Group trips to {destination.name} you can join</h2>
                    {loadingTrips ? (
                        <p className="text-muted">Loading trips…</p>
                    ) : trips.length === 0 ? (
                        <p className="text-muted">
                            No open {destination.name} trips yet.{' '}
                            <Link to={`/trips/create?destination=${q}`}>Be the first to post one</Link> and find travel buddies.
                        </p>
                    ) : (
                        <div className="dst-grid">
                            {trips.map((trip) => (
                                <Link key={trip.id} to={`/trips/${trip.id}`} className="dst-card">
                                    {trip.coverImageUrl && (
                                        <div className="dst-card-media">
                                            <img src={mediaUrl(trip.coverImageUrl)} alt={trip.title} loading="lazy" />
                                        </div>
                                    )}
                                    <div className="dst-card-body">
                                        <h3>{trip.title}</h3>
                                        <p>{fmtDate(trip.startDate)} – {fmtDate(trip.endDate)}</p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                    <p><Link to={`/trips?q=${q}`}>See all {destination.name} trips →</Link></p>
                </section>

                <section className="dst-section">
                    <h2>How to split costs on a {destination.name} trip</h2>
                    <p>
                        Add every shared expense — flights, stays, tours, meals — to the trip on PickAndSync.
                        It splits each one across the group and shows who owes whom, so nobody has to keep a spreadsheet.
                    </p>
                </section>

                {others.length > 0 && (
                    <section className="dst-section">
                        <h2>More {destination.region} group trips</h2>
                        <div className="dst-chips">
                            {others.map((d) => (
                                <Link key={d.slug} to={`/destinations/${d.slug}/`} className="dst-chip">{d.name}</Link>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}
