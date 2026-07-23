import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './TermsAcceptanceModal.css';

const POLICY_LABELS = {
    RIDE_TERMS: 'Ride Booking Terms',
    RENTAL_TERMS: 'Rental Terms & Insurance',
    LISTING_TERMS: 'Host Listing Terms',
};

const POLICY_PATHS = {
    RIDE_TERMS: '/terms/ride',
    RENTAL_TERMS: '/terms/rental',
    LISTING_TERMS: '/terms/listing',
};

export default function TermsAcceptanceModal({ isOpen, policyType, onAccept, onClose, loading }) {
    const [checked, setChecked] = useState(false);

    if (!isOpen || !policyType) return null;

    const label = POLICY_LABELS[policyType] || 'Terms & Conditions';
    const termsPath = POLICY_PATHS[policyType] || '/terms';

    const handleAccept = () => {
        if (!checked) return;
        onAccept();
    };

    return (
        <div className="terms-modal-overlay" onClick={onClose}>
            <div className="terms-modal card" onClick={(e) => e.stopPropagation()}>
                <h2>Accept {label}</h2>
                <p>
                    You must read and accept the {label.toLowerCase()} before continuing.
                    PackAndSync only facilitates bookings; providers and hosts remain responsible for the service.
                </p>
                <label className="terms-check">
                    <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
                    <span>
                        I have read and accept the{' '}
                        <Link to={termsPath} target="_blank" rel="noreferrer">{label}</Link>
                    </span>
                </label>
                <div className="terms-modal-actions">
                    <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        disabled={!checked || loading}
                        onClick={handleAccept}
                    >
                        {loading ? 'Saving…' : 'Accept & Continue'}
                    </button>
                </div>
            </div>
        </div>
    );
}
