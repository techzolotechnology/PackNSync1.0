import React from 'react';
import { Link } from 'react-router-dom';
import './RefundPolicy.css';

const CONTACT_EMAIL = 'kartikgauttam@techzolo.in';
const COMPANY = 'Techzolo Technologies LLP';

export default function RefundPolicy() {
    return (
        <div className="refund-page page-enter page-atmosphere">
            <div className="container refund-container">
                <header className="refund-header">
                    <span className="refund-eyebrow">Payments & refunds</span>
                    <h1>Refund Policy</h1>
                    <p className="refund-summary">
                        How cancellations, wallet credits, rental bookings, and payment reversals work on PackAndSync.
                    </p>
                    <p className="refund-updated">Last updated August 05, 2026</p>
                    <nav className="refund-nav" aria-label="Legal documents">
                        <Link to="/terms">General Terms</Link>
                        <Link to="/terms/ride">Ride</Link>
                        <Link to="/terms/rental">Rental</Link>
                        <Link to="/terms/listing">Listing</Link>
                        <Link to="/privacy-policy">Privacy</Link>
                        <Link to="/refund-policy" className="active">Refunds</Link>
                    </nav>
                </header>

                <article className="refund-content card">
                    <section className="refund-section">
                        <h2>1. Overview</h2>
                        <p>
                            This Refund Policy explains how <strong>PackAndSync</strong>, operated by{' '}
                            <strong>{COMPANY}</strong>, handles refunds for payments made through our website and
                            mobile app. All amounts are processed in <strong>Indian Rupees (INR)</strong> unless
                            stated otherwise.
                        </p>
                        <p>
                            By using PackAndSync, you agree to this policy together with our{' '}
                            <Link to="/terms">Terms and Conditions</Link> and{' '}
                            <Link to="/privacy-policy">Privacy Policy</Link>.
                        </p>
                    </section>

                    <section className="refund-section">
                        <h2>2. Payment methods</h2>
                        <p>We accept payments through:</p>
                        <ul>
                            <li><strong>Cards & UPI</strong> — processed securely via Cashfree.</li>
                            <li><strong>PackAndSync Wallet</strong> — in-app balance topped up via Cashfree and used for eligible bookings.</li>
                        </ul>
                        <p>
                            PackAndSync does not store your full card number or card security code. Refunds are
                            returned to the original payment method or wallet balance where technically possible.
                        </p>
                    </section>

                    <section className="refund-section">
                        <h2>3. Wallet top-ups</h2>
                        <ul>
                            <li>Successful wallet top-ups are credited to your PackAndSync wallet immediately after payment confirmation.</li>
                            <li>Unused wallet balance may be used for future in-app bookings.</li>
                            <li>Wallet top-ups are generally <strong>non-refundable</strong> once credited, except where required by law or where we approve a refund after reviewing a valid support request (duplicate charge, failed service, unauthorized transaction).</li>
                            <li>Withdrawals or payouts from wallet balance, where available, are processed separately according to our payout rules and may take several business days.</li>
                        </ul>
                    </section>

                    <section className="refund-section">
                        <h2>4. Rental bookings (cars & bikes)</h2>
                        <p>Rental bookings are made between verified hosts and renters. Refund eligibility depends on booking status and timing:</p>
                        <ul>
                            <li><strong>Pending requests</strong> — If a host has not yet accepted your booking, you may cancel without charge and any held payment will be released or refunded.</li>
                            <li><strong>Confirmed bookings</strong> — Cancellations after confirmation may be subject to host cancellation terms, platform fees, or partial refunds based on how close the trip start date is.</li>
                            <li><strong>Host cancellation</strong> — If a host cancels a confirmed booking, you are entitled to a full refund of amounts paid through PackAndSync for that booking.</li>
                            <li><strong>No-shows & misuse</strong> — Refunds are not provided for no-shows, unapproved drivers, illegal use, or damage caused by the renter.</li>
                        </ul>
                        <p>
                            See also our <Link to="/terms/rental">Rental Terms & Insurance</Link> for renter and host responsibilities.
                        </p>
                    </section>

                    <section className="refund-section">
                        <h2>5. Group trips</h2>
                        <p>
                            PackAndSync helps groups plan trips and split expenses. Trip membership itself is free unless
                            a paid add-on or linked rental applies. Refunds for trip-related payments follow the rules
                            of the underlying product (for example, a linked rental booking). Shared expense settlements
                            between trip members are managed within the group and are not automatically refunded by
                            PackAndSync unless tied to a platform payment.
                        </p>
                    </section>

                    <section className="refund-section">
                        <h2>6. Ride comparison & third-party providers</h2>
                        <p>
                            When you compare or request rides through third-party providers (such as Uber, Ola, or
                            Rapido), the ride contract and any refunds are handled directly by that provider under
                            their policies. PackAndSync does not process refunds for rides completed or cancelled
                            outside our platform.
                        </p>
                    </section>

                    <section className="refund-section">
                        <h2>7. How refunds are processed</h2>
                        <ul>
                            <li>Approved refunds are initiated by PackAndSync or our payment partner (Cashfree).</li>
                            <li>Refunds to cards or UPI typically appear within <strong>5–10 business days</strong>, depending on your bank or payment provider.</li>
                            <li>Wallet refunds are credited back to your PackAndSync wallet balance and are usually available immediately.</li>
                            <li>You will receive an email notification when a refund is initiated.</li>
                        </ul>
                    </section>

                    <section className="refund-section">
                        <h2>8. Failed or duplicate payments</h2>
                        <p>
                            If your account was charged but the booking or wallet top-up did not complete, contact us
                            with your transaction reference. We will investigate with Cashfree and issue a refund or
                            credit if the payment was captured without corresponding service delivery.
                        </p>
                    </section>

                    <section className="refund-section">
                        <h2>9. Chargebacks & disputes</h2>
                        <p>
                            Please contact us at{' '}
                            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>{' '}
                            before initiating a chargeback with your bank. Unauthorized chargebacks on valid
                            transactions may result in account suspension while we review the dispute.
                        </p>
                    </section>

                    <section className="refund-section">
                        <h2>10. Contact us</h2>
                        <p>
                            For refund requests or questions about this policy, email us with your registered account
                            email, booking ID (if applicable), payment date, and amount:
                        </p>
                        <address className="refund-address">
                            <strong>{COMPANY}</strong>
                            <br />
                            Haryana, India
                            <br />
                            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
                        </address>
                    </section>
                </article>
            </div>
        </div>
    );
}
