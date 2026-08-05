import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

const Footer = () => {
    return (
        <footer className="footer">
            <div className="container">
                <div className="footer-grid">
                    <div className="footer-brand">
                        <Link to="/" className="brand-link font-display">PackAndSync</Link>
                        <p>Travel together with shared trips and split costs — or rent a self-drive car from local hosts.</p>
                        <p className="footer-legal-name">
                            A product of <strong>TECHZOLO TECHNOLOGIES LLP</strong>
                        </p>
                    </div>

                    <div className="footer-links-group">
                        <h4>Platform</h4>
                        <ul>
                            <li><Link to="/trips">Travel Together</Link></li>
                            <li><Link to="/rentals">Cars & Bikes</Link></li>
                            <li><Link to="/trips/create">Post a Trip</Link></li>
                        </ul>
                    </div>

                    <div className="footer-links-group">
                        <h4>Company</h4>
                        <ul>
                            <li><Link to="/terms">Terms & Conditions</Link></li>
                            <li><Link to="/privacy-policy">Privacy Policy</Link></li>
                            <li><a href="mailto:kartikgauttam@techzolo.in">Contact Us</a></li>
                        </ul>
                    </div>

                    <div className="footer-newsletter">
                        <h4>Stay Updated</h4>
                        <p>Join our newsletter for travel tips.</p>
                        <form className="newsletter-form" onSubmit={(e) => e.preventDefault()}>
                            <input type="email" placeholder="Email address" className="form-input" />
                            <button type="submit" className="btn btn-primary btn-sm">Join</button>
                        </form>
                    </div>
                </div>

                <div className="footer-bottom">
                    <p>&copy; {new Date().getFullYear()} TECHZOLO TECHNOLOGIES LLP. All rights reserved.</p>
                    <div className="social-links">
                        {/* Placeholder icons or text links */}
                        <a href="#">Twitter</a>
                        <a href="#">Instagram</a>
                        <a href="#">GitHub</a>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
