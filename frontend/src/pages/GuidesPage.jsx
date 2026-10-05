import { Link } from 'react-router-dom';
import { GUIDES } from '../seo/guides.js';
import './Destinations.css';
import './GuidePage.css';

/** /guides — index of travel guides. */
export default function GuidesPage() {
    return (
        <div className="dst-page page-atmosphere page-enter">
            <div className="container">
                <header className="dst-header">
                    <p className="dst-kicker">Travel together</p>
                    <h1>Group Travel Guides</h1>
                    <p className="dst-lead">
                        Trip plans, checklists and money tips for travelling with friends, family or your partner.
                    </p>
                </header>

                <div className="guide-list">
                    {GUIDES.map((g) => (
                        <Link key={g.slug} to={`/guides/${g.slug}/`} className="guide-list-item">
                            <span className="guide-tags">{g.tags.slice(0, 3).join(' · ')}</span>
                            <h2>{g.title}</h2>
                            <p>{g.description}</p>
                            <span className="guide-meta">{g.readMinutes} min read</span>
                        </Link>
                    ))}
                </div>

                <section className="dst-section splitter-cta-inline">
                    <h2>Free tool: trip cost splitter</h2>
                    <p>
                        Add your group and expenses, see who owes whom, and share the result on WhatsApp — no sign-up.{' '}
                        <Link to="/tools/trip-cost-splitter/">Open the splitter →</Link>
                    </p>
                </section>
            </div>
        </div>
    );
}
