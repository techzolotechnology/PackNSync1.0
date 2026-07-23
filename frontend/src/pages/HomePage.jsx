import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';
import './HomePage.css';

const STEPS = [
    { n: '01', title: 'Post a trip', desc: 'Share where you’re going and when. Your route becomes a joinable trip.' },
    { n: '02', title: 'Others join', desc: 'Travelers request to join. You approve who comes along.' },
    { n: '03', title: 'Split the money', desc: 'Add fuel, stay, or food costs and split fairly across the group.' },
];

export default function HomePage() {
    const user = useAuthStore((s) => s.user);

    return (
        <div className="home page-enter">
            <section className="hero">
                <div className="hero-atmosphere" aria-hidden="true" />
                <div className="container hero-stage">
                    <p className="brand-mark font-display">PackAndSync</p>
                    <h1 className="hero-title">
                        Travel together.
                        <br />
                        <span className="gradient-text">Rent when you need.</span>
                    </h1>
                    <p className="hero-subtitle">
                        Post a trip for others to join and split costs — or book a self-drive car from a local host.
                    </p>
                    <div className="hero-ctas">
                        <Link to="/trips" className="btn btn-primary btn-lg">Travel Together</Link>
                        <Link to="/rentals" className="btn btn-ghost btn-lg">Car on Rent</Link>
                    </div>
                </div>
            </section>

            <section className="pathways">
                <div className="container pathways-grid">
                    <Link to="/trips" className="pathway pathway-trips">
                        <span className="pathway-kicker">Module one</span>
                        <h2 className="font-display">Travel Together</h2>
                        <p>One person posts the trip. Friends and travelers join the route and share the cost.</p>
                        <span className="pathway-cta">Browse trips →</span>
                    </Link>
                    <Link to="/rentals" className="pathway pathway-rentals">
                        <span className="pathway-kicker">Module two</span>
                        <h2 className="font-display">Car on Rent</h2>
                        <p>Self-drive cars from community hosts — weekends, outer-city runs, full control of the wheel.</p>
                        <span className="pathway-cta">Find a car →</span>
                    </Link>
                </div>
            </section>

            <section className="steps-section">
                <div className="container">
                    <h2 className="section-title font-display">How Travel Together works</h2>
                    <p className="section-subtitle">Built for group trips — not ride price comparison.</p>
                    <ol className="steps-row">
                        {STEPS.map((s) => (
                            <li key={s.n} className="step-item">
                                <span className="step-n">{s.n}</span>
                                <h3>{s.title}</h3>
                                <p>{s.desc}</p>
                            </li>
                        ))}
                    </ol>
                </div>
            </section>

            <section className="cta-section">
                <div className="container cta-inner">
                    <h2 className="font-display">Ready for the next trip?</h2>
                    <p>Post a route, let people join, and keep shared money clear.</p>
                    <div className="hero-ctas" style={{ justifyContent: 'center', marginBottom: 0 }}>
                        <Link to={user ? '/trips/create' : '/register'} className="btn btn-primary btn-lg">
                            {user ? 'Post a Trip' : 'Get started free'}
                        </Link>
                        <Link to="/host" className="btn btn-ghost btn-lg">Host a car</Link>
                    </div>
                </div>
            </section>
        </div>
    );
}
