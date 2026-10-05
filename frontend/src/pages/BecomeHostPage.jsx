import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';
import { useAuthUiStore } from '../store/authUiStore.js';
import { formatMoney } from '../config/markets.js';
import './Destinations.css';
import './BecomeHostPage.css';

const DEFAULTS = {
    car: { price: 2000, min: 500, max: 10000, step: 100 },
    bike: { price: 500, min: 150, max: 3000, step: 50 },
};

const STEPS = [
    { title: 'Sign up and verify', body: 'Create an account with your email and complete a one-time ID check (Aadhaar + driving licence).' },
    { title: 'Add your vehicle', body: 'Enter the make, model and plate, and upload a clear photo of the RC. Our team reviews it.' },
    { title: 'Set price and dates', body: 'Choose your per-day price and the dates the vehicle is free. Change them any time.' },
    { title: 'Approve each request', body: 'You see who wants to rent and for which dates. Nothing is booked until you confirm.' },
];

const FAQS = [
    {
        q: 'Who can rent my car?',
        a: 'Only renters who have completed ID verification (Aadhaar and driving licence) and accepted the rental terms can send a booking request.',
    },
    {
        q: 'Do I have to accept every booking?',
        a: 'No. Every request waits for your approval, and you can decline any request.',
    },
    {
        q: 'Can I list a bike or scooter?',
        a: 'Yes. Cars, CNG cars, bikes and scooters can all be listed.',
    },
];

/** /become-a-host — public host acquisition page (the dashboard at /host needs login). */
export default function BecomeHostPage() {
    const user = useAuthStore((s) => s.user);
    const openAuth = useAuthUiStore((s) => s.openAuth);
    const [kind, setKind] = useState('car');
    const [price, setPrice] = useState(DEFAULTS.car.price);
    const [days, setDays] = useState(8);

    const monthly = useMemo(() => price * days, [price, days]);
    const range = DEFAULTS[kind];

    const switchKind = (next) => {
        setKind(next);
        setPrice(DEFAULTS[next].price);
    };

    const cta = user ? (
        <Link to="/host" className="btn btn-primary">List your vehicle</Link>
    ) : (
        <button type="button" className="btn btn-primary" onClick={() => openAuth('register')}>
            Sign up to list your vehicle
        </button>
    );

    return (
        <div className="dst-page page-atmosphere page-enter">
            <div className="container">
                <header className="dst-hero">
                    <div className="dst-hero-text">
                        <p className="dst-kicker">Host on PickAndSync</p>
                        <h1>Rent Out Your Car or Bike and Earn When You&apos;re Not Driving</h1>
                        <p className="dst-lead">
                            List your vehicle for weekend trippers in Bangalore and other cities.
                            You set the price, pick the dates, and approve every renter.
                        </p>
                        <div className="dst-actions">{cta}</div>
                    </div>

                    <div className="host-calc card" aria-label="Earnings estimate">
                        <div className="host-calc-toggle" role="tablist" aria-label="Vehicle type">
                            <button
                                type="button"
                                role="tab"
                                aria-selected={kind === 'car'}
                                className={kind === 'car' ? 'active' : ''}
                                onClick={() => switchKind('car')}
                            >
                                Car
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={kind === 'bike'}
                                className={kind === 'bike' ? 'active' : ''}
                                onClick={() => switchKind('bike')}
                            >
                                Bike / scooter
                            </button>
                        </div>

                        <label className="host-calc-field">
                            <span>Price per day <strong>{formatMoney(price)}</strong></span>
                            <input
                                type="range"
                                min={range.min}
                                max={range.max}
                                step={range.step}
                                value={price}
                                onChange={(e) => setPrice(Number(e.target.value))}
                            />
                        </label>

                        <label className="host-calc-field">
                            <span>Days rented per month <strong>{days}</strong></span>
                            <input
                                type="range"
                                min={1}
                                max={25}
                                value={days}
                                onChange={(e) => setDays(Number(e.target.value))}
                            />
                        </label>

                        <div className="host-calc-result">
                            <span>Estimated bookings per month</span>
                            <strong>{formatMoney(monthly)}</strong>
                            <small>Estimate before platform fees, fuel and maintenance. Actual demand varies by city and season.</small>
                        </div>
                    </div>
                </header>

                <section className="dst-section">
                    <h2>How hosting works</h2>
                    <ol className="host-steps">
                        {STEPS.map((step) => (
                            <li key={step.title}>
                                <strong>{step.title}</strong>
                                <p>{step.body}</p>
                            </li>
                        ))}
                    </ol>
                </section>

                <section className="dst-section">
                    <h2>Why hosts list on PickAndSync</h2>
                    <ul className="dst-highlights">
                        <li>You approve every booking request</li>
                        <li>Renters are ID-verified before they can book</li>
                        <li>You set your own price and available dates</li>
                        <li>Group travellers often book for whole weekends</li>
                    </ul>
                </section>

                <section className="dst-section">
                    <h2>Host FAQs</h2>
                    <dl className="host-faq">
                        {FAQS.map((f) => (
                            <div key={f.q}>
                                <dt>{f.q}</dt>
                                <dd>{f.a}</dd>
                            </div>
                        ))}
                    </dl>
                </section>

                <section className="dst-section host-final-cta">
                    <h2>Ready to earn from your vehicle?</h2>
                    <div className="dst-actions">{cta}</div>
                </section>
            </div>
        </div>
    );
}
