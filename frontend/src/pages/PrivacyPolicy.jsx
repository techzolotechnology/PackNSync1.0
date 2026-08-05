import React from 'react';
import { Link } from 'react-router-dom';
import './PrivacyPolicy.css';

const PrivacyPolicy = () => {
    return (
        <div className="privacy-page page-enter page-atmosphere">
            <div className="container privacy-container">
                <header className="privacy-header">
                    <span className="privacy-eyebrow">Your data, explained</span>
                    <h1>Privacy Policy</h1>
                    <p className="privacy-summary">A clear overview of what PackAndSync collects, why we use it, and the choices available to you.</p>
                    <p className="last-updated">Last updated August 05, 2026</p>
                    <nav className="privacy-nav" aria-label="Legal documents">
                        <Link to="/terms">General Terms</Link>
                        <Link to="/terms/ride">Ride</Link>
                        <Link to="/terms/rental">Rental</Link>
                        <Link to="/terms/listing">Listing</Link>
                        <Link to="/privacy-policy" className="active">Privacy</Link>
                        <Link to="/refund-policy">Refunds</Link>
                    </nav>
                </header>

                <div className="privacy-content card">
                    <section className="privacy-section">
                        <h2>1. Introduction</h2>
                        <p>
                            Welcome to <strong>PackAndSync</strong>, a platform owned and operated by
                            {' '}<strong>TECHZOLO TECHNOLOGIES LLP</strong> (“we”, “us”, “our”).
                            We are committed to protecting your personal information and your right to privacy.
                            If you have any questions or concerns about this privacy notice, or our practices with regards to your personal information,
                            please contact us at privacy@packandsync.com.
                        </p>
                    </section>

                    <section className="privacy-section">
                        <h2>2. Information We Collect</h2>
                        <p>We collect personal information that you voluntarily provide to us when you register on the App, express an interest in obtaining information about us or our products and Services, or otherwise when you contact us.</p>
                        <ul>
                            <li><strong>Personal Data:</strong> Name, email address, phone number, and profile picture.</li>
                            <li><strong>Travel Data:</strong> Trip details, itineraries, and preferences you share in travel groups.</li>
                            <li><strong>Payment Data:</strong> Payments and wallet top-ups are processed by <strong>Cashfree</strong>. PackAndSync does not store your full card number or card security code.</li>
                            <li><strong>Social Media Login:</strong> We may provide you with the option to register with us using your existing social media account details, like your Google account.</li>
                        </ul>
                    </section>

                    <section className="privacy-section">
                        <h2>3. How We Use Your Information</h2>
                        <p>We use personal information collected via our App for a variety of business purposes described below:</p>
                        <ul>
                            <li>To facilitate account creation and logon process.</li>
                            <li>To post testimonials with your consent.</li>
                            <li>To manage user accounts and provide support.</li>
                            <li>To send administrative information to you.</li>
                            <li>To enable user-to-user communication.</li>
                            <li>To connect with third-party ride services (Uber, Ola, Rapido) upon your request.</li>
                        </ul>
                    </section>

                    <section className="privacy-section">
                        <h2>4. Sharing Your Information</h2>
                        <p>We only share information with your consent, to comply with laws, to provide you with services, to protect your rights, or to fulfill business obligations.</p>
                        <ul>
                            <li><strong>Ride Service Providers:</strong> When you connect your Uber, Ola, or Rapido accounts, we share necessary authentication tokens to fetch prices and book rides on your behalf.</li>
                            <li><strong>Service Providers:</strong> We may share your data with third-party vendors, service providers, contractors or agents who perform services for us or on our behalf.</li>
                        </ul>
                    </section>

                    <section className="privacy-section">
                        <h2>5. Data Security</h2>
                        <p>
                            We have implemented appropriate technical and organizational security measures designed to protect the security of any personal information we process.
                            However, despite our safeguards and efforts to secure your information, no electronic transmission over the Internet or information storage technology
                            can be guaranteed to be 100% secure.
                        </p>
                    </section>

                    <section className="privacy-section">
                        <h2>6. Your Privacy Rights</h2>
                        <p>
                            In some regions (like the EEA and UK), you have certain rights under applicable data protection laws.
                            These may include the right (i) to request access and obtain a copy of your personal information,
                            (ii) to request rectification or erasure; (iii) to restrict the processing of your personal information;
                            and (iv) if applicable, to data portability.
                        </p>
                    </section>

                    <section className="privacy-section">
                        <h2>7. Contact Us</h2>
                        <p>
                            If you have questions or comments about this notice, you may email us at <strong>privacy@packandsync.com</strong> or by post to:
                        </p>
                        <address className="contact-address">
                            TECHZOLO TECHNOLOGIES LLP<br />
                            190, Gauttam Bahawan<br />
                            Rattakhera, Safidon, Jind<br />
                            Haryana, India - 126112
                        </address>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default PrivacyPolicy;
