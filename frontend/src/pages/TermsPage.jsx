import React from 'react';
import { Link, useParams } from 'react-router-dom';
import './TermsPage.css';

const TERMS = {
    ride: {
        title: 'Ride Booking Terms',
        version: '1.0',
        sections: [
            {
                heading: 'Platform role',
                body: 'PackAndSync is an aggregator. We help you compare and request rides from third-party providers (Uber, Ola, Rapido, etc.). The underlying provider is solely responsible for the ride, driver, vehicle, and on-road service.',
            },
            {
                heading: 'No service guarantee',
                body: 'We do not guarantee uninterrupted, error-free, or always-available ride services. Fares and ETAs are estimates from provider APIs and may change before booking is confirmed.',
            },
            {
                heading: 'User responsibilities',
                body: 'You must carry valid government ID and, where required, a valid driving license. You are responsible for accurate pickup/dropoff details and for complying with provider policies.',
            },
            {
                heading: 'Limitation of liability',
                body: 'To the maximum extent permitted by law, PackAndSync liability for ride booking facilitation is limited. Reference industry practice (e.g. Rapido-style caps on platform liability for consumer claims). Providers remain liable for ride execution.',
            },
        ],
    },
    rental: {
        title: 'Rental Terms & Insurance',
        version: '1.0',
        sections: [
            {
                heading: 'Renter liability',
                body: 'Following peer-to-peer rental norms (Zoomcar-style policies), the renter is fully and personally liable for all costs and damages not covered by insurance during the rental period.',
            },
            {
                heading: 'Vehicle condition',
                body: 'Inspect the vehicle at pickup. Report existing damage before driving. Return the vehicle in the same condition, on time, and with agreed fuel level.',
            },
            {
                heading: 'Accidents & misuse',
                body: 'Report accidents immediately to local authorities (file FIR where required) and notify the host and PackAndSync support. Misuse, illegal activity, or unapproved drivers void coverage.',
            },
            {
                heading: 'Platform role',
                body: 'PackAndSync facilitates listings and booking requests between verified hosts and renters. We are not the vehicle owner and do not assume liability for loss or damage between parties beyond our facilitation role.',
            },
        ],
    },
    listing: {
        title: 'Host Listing Terms',
        version: '1.0',
        sections: [
            {
                heading: 'Eligibility',
                body: 'Only verified hosts with approved KYC (Aadhaar, Driving License) and verified vehicle RC may list cars on PackAndSync.',
            },
            {
                heading: 'Accurate listings',
                body: 'You must provide truthful vehicle details, photos, pricing, availability, and location. Misleading listings may be removed and accounts suspended.',
            },
            {
                heading: 'Insurance & compliance',
                body: 'Your vehicle must have valid registration, insurance, and permits required by local law. You are responsible for maintaining roadworthiness.',
            },
            {
                heading: 'Bookings & payouts',
                body: 'You agree to honor confirmed booking requests, communicate promptly with renters, and comply with PackAndSync cancellation and payout policies.',
            },
        ],
    },
};

export default function TermsPage() {
    const { type = 'ride' } = useParams();
    const content = TERMS[type] || TERMS.ride;

    return (
        <div className="terms-page page-enter">
            <div className="container terms-container">
                <header className="terms-header">
                    <h1>{content.title}</h1>
                    <p>Version {content.version} • Last updated July 2026</p>
                    <div className="terms-nav">
                        <Link to="/terms">General Terms</Link>
                        <Link to="/terms/ride" className={type === 'ride' ? 'active' : ''}>Ride</Link>
                        <Link to="/terms/rental" className={type === 'rental' ? 'active' : ''}>Rental</Link>
                        <Link to="/terms/listing" className={type === 'listing' ? 'active' : ''}>Listing</Link>
                        <Link to="/privacy-policy">Privacy</Link>
                    </div>
                </header>
                <div className="terms-content card">
                    {content.sections.map((section) => (
                        <section key={section.heading}>
                            <h2>{section.heading}</h2>
                            <p>{section.body}</p>
                        </section>
                    ))}
                    <section>
                        <h2>Operating entity</h2>
                        <p>
                            PackAndSync is owned and operated by TECHZOLO TECHNOLOGIES LLP,
                            registered in Haryana, India. These terms form an agreement between you
                            and TECHZOLO TECHNOLOGIES LLP. For questions, contact
                            {' '}<a href="mailto:hello@packandsync.com">hello@packandsync.com</a>.
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
}
