import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import useSeo from '../hooks/useSeo.js';
import { ROUTE_SEO } from '../seo/seoConfig.js';
import './Destinations.css';
import './ComparePage.css';

// PickAndSync vs the two best-known trackers. Kept factual and defensible:
// both Splitwise and Tricount are expense *trackers* — they record who owes
// whom but do not move money; PickAndSync settles over UPI and bundles trips.
const COMPARISON = [
    ['Free to split group expenses', true, 'Limited on free plan', true],
    ['Start splitting with no sign-up', true, false, false],
    ['See who owes whom, fewest settle-ups', true, true, true],
    ['Settle up over UPI inside the app', true, 'Record only', 'Record only'],
    ['Plan the group trip together', true, false, false],
    ['Rent a self-drive car or bike', true, false, false],
    ['Promo credit & referral rewards', true, false, false],
    ['Built for India (₹, UPI)', true, 'Partly', 'Partly'],
];

const FEATURES = [
    ['wallet', "Doesn't just track — it settles", 'Other apps stop at "you owe ₹600." PickAndSync lets the group actually settle up over UPI, so nobody has to chase payments after the trip.'],
    ['map', 'The whole trip in one place', 'Plan the itinerary, chat with the group, split costs, and even rent the car or bike — instead of juggling a planner, a chat and a separate split app.'],
    ['bolt', 'Free and instant', 'Open the splitter, add people and costs, and share the link on WhatsApp — no account needed to start. Sign in only when you want to settle up or save it.'],
];

const FAQ = [
    ['Is PickAndSync a good Splitwise or Tricount alternative?',
        'Yes. It does the same core job — split shared expenses and show who owes whom — and adds UPI settle-up, group-trip planning and self-drive rentals, with pricing and payments built for India.'],
    ['Is the expense splitter free?',
        'Yes. The trip cost splitter is free and needs no sign-up to start. You add your group and shared costs, and it shows the fewest payments to settle up.'],
    ['Does it actually move money, or just track it?',
        'Both are possible. It shows balances like a tracker, and when you are signed in you can settle up over UPI through the PickAndSync wallet — so the debts get cleared, not just recorded.'],
    ['Can I use it for a roommate or group trip in India?',
        'It is built for group trips and getaways — Goa, Manali, Coorg, a weekend road trip — where you also split fuel, stays, food and the rental. Everything for the trip stays in one app.'],
];

const Cell = ({ value }) => {
    if (value === true) return <span className="cmp-yes" aria-label="Yes">✓</span>;
    if (value === false) return <span className="cmp-no" aria-label="No">—</span>;
    return <span className="cmp-note">{value}</span>;
};

/** /split-expenses-app — comparison landing page targeting "Splitwise / Tricount alternative". */
export default function ComparePage() {
    const jsonLd = useMemo(() => ({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: FAQ.map(([question, answer]) => ({
            '@type': 'Question',
            name: question,
            acceptedAnswer: { '@type': 'Answer', text: answer },
        })),
    }), []);

    useSeo({ ...ROUTE_SEO['split-expenses-app'], path: 'split-expenses-app', jsonLd });

    return (
        <div className="dst-page page-atmosphere page-enter">
            <div className="container">
                <nav className="dst-crumbs" aria-label="Breadcrumb">
                    <Link to="/">Home</Link> <span aria-hidden="true">/</span> Split expenses app
                </nav>

                <header className="cmp-hero">
                    <h1>Split expenses with friends — free, and settle up over UPI</h1>
                    <p className="dst-lead">
                        PickAndSync is a free bill-splitting app built for India — a simple Splitwise and
                        Tricount alternative that doesn&apos;t just track who owes whom. Settle up over UPI,
                        plan the group trip, and even rent the car, all in one place.
                    </p>
                    <div className="dst-actions">
                        <Link to="/tools/trip-cost-splitter" className="btn btn-primary">Open the free splitter</Link>
                        <Link to="/trips" className="btn btn-ghost">See group trips</Link>
                    </div>
                </header>

                <section className="cmp-section" aria-labelledby="cmp-table-h">
                    <h2 id="cmp-table-h">PickAndSync vs Splitwise vs Tricount</h2>
                    <div className="cmp-table-wrap">
                        <table className="cmp-table">
                            <thead>
                                <tr>
                                    <th scope="col">Feature</th>
                                    <th scope="col" className="cmp-brand">PickAndSync</th>
                                    <th scope="col">Splitwise</th>
                                    <th scope="col">Tricount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {COMPARISON.map(([label, a, b, c]) => (
                                    <tr key={label}>
                                        <th scope="row">{label}</th>
                                        <td className="cmp-brand"><Cell value={a} /></td>
                                        <td><Cell value={b} /></td>
                                        <td><Cell value={c} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="cmp-fineprint">
                        Comparison reflects each app&apos;s standard free offering and may change. Splitwise and
                        Tricount are expense trackers that record balances; PickAndSync adds UPI settle-up and
                        group-trip tools.
                    </p>
                </section>

                <section className="cmp-section">
                    <h2>Why groups in India switch</h2>
                    <div className="cmp-grid">
                        {FEATURES.map(([, title, body]) => (
                            <div key={title} className="card cmp-card">
                                <h3>{title}</h3>
                                <p>{body}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="cmp-section">
                    <h2>Questions people ask</h2>
                    <div className="cmp-faq">
                        {FAQ.map(([q, a]) => (
                            <details key={q} className="cmp-faq-item">
                                <summary>{q}</summary>
                                <p>{a}</p>
                            </details>
                        ))}
                    </div>
                </section>

                <section className="cmp-cta card">
                    <h2>Split the trip, not the friendship</h2>
                    <p>Add your group, share the link, and settle up over UPI when you get back.</p>
                    <div className="dst-actions">
                        <Link to="/tools/trip-cost-splitter" className="btn btn-primary">Try the free splitter</Link>
                        <Link to="/trips" className="btn btn-ghost">Plan a group trip</Link>
                    </div>
                </section>
            </div>
        </div>
    );
}
