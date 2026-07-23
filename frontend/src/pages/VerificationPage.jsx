import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import './VerificationPage.css';
import { verificationsApi } from '../api/index.js';

const STEPS = [
    { type: 'AADHAAR', title: 'Aadhaar', desc: 'Government ID for traveler KYC', required: true },
    { type: 'DL', title: 'Driving License', desc: 'Required to rent or drive listed cars', required: true },
    { type: 'RC', title: 'Vehicle RC', desc: 'Only if you host a car for rent', required: false },
];

const docStatus = (records, type) => {
    const record = records?.find((v) => v.documentType === type);
    if (!record) return 'idle';
    return record.status.toLowerCase();
};

const statusMeta = (status, required) => {
    if (status === 'verified') return { label: 'Verified', tone: 'ok' };
    if (status === 'pending') return { label: 'In review', tone: 'warn' };
    if (status === 'rejected') return { label: 'Rejected', tone: 'bad' };
    if (!required) return { label: 'Optional', tone: 'mute' };
    return { label: 'Needed', tone: 'mute' };
};

const overallMeta = (status) => {
    if (status?.isFullyVerified) return { label: 'KYC approved', tone: 'ok', hint: 'You’re cleared for rentals and hosting.' };
    if (status?.hasPendingKyc) return { label: 'Waiting on admin', tone: 'warn', hint: 'Documents received. An admin will approve shortly.' };
    if (status?.hasRejectedKyc) return { label: 'Action needed', tone: 'bad', hint: 'Something was rejected — submit again via DigiLocker.' };
    return { label: 'Not started', tone: 'mute', hint: 'Connect DigiLocker to submit Aadhaar and Driving License.' };
};

export default function VerificationPage() {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [rcPlate, setRcPlate] = useState('');
    const [rcFile, setRcFile] = useState(null);
    const [ocrResult, setOcrResult] = useState(null);

    useEffect(() => {
        fetchStatus();
    }, []);

    const fetchStatus = async () => {
        setLoading(true);
        setLoadError('');
        try {
            const res = await verificationsApi.getStatus();
            setStatus(res.data.data);
        } catch (err) {
            const msg = err.response?.data?.message || 'Unable to load verification status.';
            setLoadError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleDigiLocker = async () => {
        setActionLoading(true);
        try {
            const res = await verificationsApi.connectDigiLocker();
            toast.success(res.data.message || 'Documents submitted for admin review.');
            fetchStatus();
        } catch (err) {
            toast.error(err.response?.data?.message || 'DigiLocker connection failed.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleRcOcrUpload = async (e) => {
        e.preventDefault();
        if (!rcPlate.trim()) return toast.error('Enter the vehicle license plate.');
        if (!rcFile) return toast.error('Choose a clear photo of the RC.');

        setActionLoading(true);
        setOcrResult(null);
        try {
            const res = await verificationsApi.uploadRcOcr(rcPlate.trim(), rcFile);
            setOcrResult(res.data.data?.ocr || null);
            toast.success(res.data.message || 'RC processed.');
            setRcFile(null);
            e.target.reset();
            fetchStatus();
        } catch (err) {
            toast.error(err.response?.data?.message || 'RC OCR upload failed.');
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="verify-page">
                <div className="verify-shell">
                    <p className="verify-loading">Checking your verification status…</p>
                </div>
            </div>
        );
    }

    if (loadError || !status) {
        return (
            <div className="verify-page">
                <div className="verify-shell">
                    <header className="verify-hero">
                        <p className="verify-kicker">Trust & safety</p>
                        <h1 className="font-display">Identity verification</h1>
                        <p>{loadError || 'Could not load your verification status.'}</p>
                    </header>
                    <button type="button" className="btn btn-primary verify-primary-btn" onClick={fetchStatus}>
                        Try again
                    </button>
                    <p className="verify-foot">
                        Session expired? <Link to="/login">Log in again</Link>
                    </p>
                </div>
            </div>
        );
    }

    const verifications = status.verifications || [];
    const overall = overallMeta(status);
    const doneCount = STEPS.filter((s) => s.required && docStatus(verifications, s.type) === 'verified').length;
    const requiredTotal = STEPS.filter((s) => s.required).length;

    return (
        <div className="verify-page page-enter">
            <div className="verify-glow" aria-hidden="true" />
            <div className="verify-shell">
                <header className="verify-hero">
                    <p className="verify-kicker">Trust & safety</p>
                    <div className="verify-hero-top">
                        <h1 className="font-display">Verify your identity</h1>
                        <span className={`verify-chip tone-${overall.tone}`}>{overall.label}</span>
                    </div>
                    <p>{overall.hint}</p>
                    <div className="verify-progress" aria-label="KYC progress">
                        <div className="verify-progress-track">
                            <div
                                className="verify-progress-fill"
                                style={{ width: `${(doneCount / requiredTotal) * 100}%` }}
                            />
                        </div>
                        <span>{doneCount} of {requiredTotal} required docs verified</span>
                    </div>
                </header>

                <section className="verify-panel">
                    <div className="verify-panel-head">
                        <h2>Required for rentals</h2>
                        <p>One DigiLocker connect submits Aadhaar + Driving License for admin review.</p>
                    </div>

                    <ul className="verify-list">
                        {STEPS.map((step) => {
                            const s = docStatus(verifications, step.type);
                            const meta = statusMeta(s, step.required);
                            return (
                                <li key={step.type} className={`verify-row tone-${meta.tone}`}>
                                    <div className="verify-row-mark" aria-hidden="true">
                                        {s === 'verified' ? '✓' : s === 'pending' ? '…' : step.required ? '○' : '–'}
                                    </div>
                                    <div className="verify-row-copy">
                                        <strong>{step.title}</strong>
                                        <span>{step.desc}</span>
                                    </div>
                                    <span className={`verify-pill tone-${meta.tone}`}>{meta.label}</span>
                                </li>
                            );
                        })}
                    </ul>

                    {!status.isFullyVerified ? (
                        <button
                            type="button"
                            className="btn btn-primary verify-primary-btn"
                            onClick={handleDigiLocker}
                            disabled={actionLoading}
                        >
                            {actionLoading ? 'Connecting DigiLocker…' : status.hasPendingKyc ? 'Resubmit via DigiLocker' : 'Continue with DigiLocker'}
                        </button>
                    ) : (
                        <div className="verify-success-banner">
                            Identity checks passed. You can rent cars and post trips freely.
                        </div>
                    )}
                </section>

                <section className="verify-panel verify-panel-secondary">
                    <div className="verify-panel-head">
                        <h2>For hosts — vehicle RC</h2>
                        <p>Add a vehicle on Host, then upload a clear RC photo. OCR checks plate + make/model.</p>
                    </div>

                    <form className="verify-rc-form" onSubmit={handleRcOcrUpload}>
                        <label>
                            License plate
                            <input
                                type="text"
                                placeholder="KA01AB1234"
                                value={rcPlate}
                                onChange={(e) => setRcPlate(e.target.value.toUpperCase())}
                            />
                        </label>
                        <label className="verify-file">
                            RC photo
                            <span className="verify-file-box">
                                {rcFile ? rcFile.name : 'Choose JPG, PNG, or WEBP'}
                            </span>
                            <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                onChange={(e) => setRcFile(e.target.files?.[0] || null)}
                            />
                        </label>
                        <button type="submit" className="btn btn-ghost verify-rc-btn" disabled={actionLoading}>
                            {actionLoading ? 'Scanning…' : 'Upload & scan RC'}
                        </button>
                    </form>

                    {ocrResult && (
                        <div className={`ocr-result ${ocrResult.autoApproved ? 'ok' : 'warn'}`}>
                            <strong>{ocrResult.autoApproved ? 'Auto-approved' : 'Needs admin review'}</strong>
                            <ul>
                                <li>Plate: {ocrResult.checks?.plate ? 'Match' : 'No match'} ({ocrResult.checks?.extractedPlate || 'not found'})</li>
                                <li>Make: {ocrResult.checks?.make ? 'Match' : 'No match'}</li>
                                <li>Model: {ocrResult.checks?.model ? 'Match' : 'No match'}</li>
                                <li>Confidence: {Math.round(ocrResult.confidence || 0)}%</li>
                            </ul>
                        </div>
                    )}
                </section>

                <p className="verify-foot">
                    Used only for KYC review. Read the <Link to="/privacy-policy">Privacy Policy</Link>.
                    {' · '}
                    <Link to="/host">Host dashboard</Link>
                </p>
            </div>
        </div>
    );
}
