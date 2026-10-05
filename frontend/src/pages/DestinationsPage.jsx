import { Link } from 'react-router-dom';
import { DESTINATIONS } from '../seo/destinations.js';
import './Destinations.css';

/** /destinations — index of international group-trip destinations. */
export default function DestinationsPage() {
    const regions = [...new Set(DESTINATIONS.map((d) => d.region))];

    return (
        <div className="dst-page page-atmosphere page-enter">
            <div className="container">
                <header className="dst-header">
                    <p className="dst-kicker">Travel together abroad</p>
                    <h1>International Group Trips from India</h1>
                    <p className="dst-lead">
                        Pick a destination, get an AI itinerary, find travel buddies already going,
                        and split every cost fairly in one place.
                    </p>
                </header>

                {regions.map((region) => (
                    <section key={region} className="dst-region">
                        <h2>{region}</h2>
                        <div className="dst-grid">
                            {DESTINATIONS.filter((d) => d.region === region).map((d) => (
                                <Link key={d.slug} to={`/destinations/${d.slug}/`} className="dst-card">
                                    <div className="dst-card-media">
                                        <img src={d.image} alt={`${d.name} group trip`} loading="lazy" />
                                    </div>
                                    <div className="dst-card-body">
                                        <h3>{d.name}</h3>
                                        <p>{d.idealDays} · Best: {d.bestTime.split(' (')[0]}</p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>
                ))}
            </div>
        </div>
    );
}
