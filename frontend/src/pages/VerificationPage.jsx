import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
    if (status === 'processing') return { label: 'Checking', tone: 'warn' };
    if (status === 'rejected') return { label: 'Rejected', tone: 'bad' };
    if (!required) return { label: 'Optional', tone: 'mute' };
    return { label: 'Needed', tone: 'mute' };
};

const overallMeta = (status) => {
    if (status?.isFullyVerified) return { label: 'KYC approved', tone: 'ok', hint: 'You’re cleared for rentals and hosting.' };
    if (Object.values(status?.latestByType || {}).some((record) => record?.status === 'PROCESSING')) return { label: 'Cashfree is checking', tone: 'warn', hint: 'Finish the secure provider step or return here to refresh your status.' };
    if (status?.hasPendingKyc) return { label: 'Waiting on review', tone: 'warn', hint: 'Your documents are waiting for review.' };
    if (status?.hasRejectedKyc) {
        const reasons = Object.values(status.latestByType || {})
            .filter((v) => v?.status === 'REJECTED' && v.rejectionReason)
            .map((v) => `${v.documentType}: ${v.rejectionReason}`);
        return {
            label: 'Action needed',
            tone: 'bad',
            hint: reasons.length
                ? `Rejected — ${reasons.join('; ')}. Fix this and submit again.`
                : 'Something was rejected — submit again for Cashfree verification.',
        };
    }
    return { label: 'Not started', tone: 'mute', hint: 'Verify Aadhaar with Cashfree and DigiLocker, then verify your driving licence.' };
};

export default function VerificationPage() {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [rcPlate, setRcPlate] = useState('');
    const [rcFile, setRcFile] = useState(null);
    const [ocrResult, setOcrResult] = useState(null);
    const [searchParams, setSearchParams] = useSearchParams();
    const [licenseNumber, setLicenseNumber] = useState('');
    const [licenseDob, setLicenseDob] = useState('');
    const [manualFallbackOpen, setManualFallbackOpen] = useState(false);
    const [manualDocType, setManualDocType] = useState('AADHAAR');
    const [manualFile, setManualFile] = useState(null);
    const [emergencyToken, setEmergencyToken] = useState('');

    const openEmergencyReview = (err, documentType) => {
        if (err.response?.status !== 503 || !err.response.data?.emergencyToken) return;
        setManualDocType(documentType);
        setEmergencyToken(err.response.data.emergencyToken);
        setManualFallbackOpen(true);
    };

    useEffect(() => {
        fetchStatus();
    }, []);

    useEffect(() => {
        const verificationId = searchParams.get('cashfreeVerificationId');
        if (!verificationId) return;
        setActionLoading(true);
        verificationsApi.syncCashfreeDigiLockerStatus(verificationId)
            .then((res) => {
                toast.success(res.data.message || 'Cashfree verification status updated.');
                return fetchStatus();
            })
            .catch((err) => {
                openEmergencyReview(err, 'AADHAAR');
                toast.error(err.response?.data?.message || 'Unable to check Cashfree verification yet.');
            })
            .finally(() => {
                setActionLoading(false);
                const next = new URLSearchParams(searchParams);
                next.delete('cashfreeVerificationId');
                setSearchParams(next, { replace: true });
            });
    }, [searchParams, setSearchParams]);

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
            const redirectUrl = res.data.data?.redirectUrl;
            if (!redirectUrl) throw new Error('Cashfree did not return a verification link.');
            window.location.assign(redirectUrl);
        } catch (err) {
            openEmergencyReview(err, 'AADHAAR');
            toast.error(err.response?.data?.message || err.message || 'Cashfree verification could not start.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleDrivingLicense = async (event) => {
        event.preventDefault();
        setActionLoading(true);
        try {
            const res = await verificationsApi.verifyDrivingLicenseWithCashfree(licenseNumber, licenseDob);
            toast.success(res.data.message || 'Driving licence checked by Cashfree.');
            setLicenseNumber('');
            setLicenseDob('');
            await fetchStatus();
        } catch (err) {
            openEmergencyReview(err, 'DL');
            toast.error(err.response?.data?.message || 'Cashfree could not verify the driving licence.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleManualFallback = async (event) => {
        event.preventDefault();
        if (!manualFile) return toast.error('Choose the document image to submit.');
        setActionLoading(true);
        try {
            const res = await verificationsApi.submit(manualDocType, manualFile, emergencyToken);
            toast.success(res.data.message || 'Document sent for emergency review.');
            setManualFile(null);
            setEmergencyToken('');
            setManualFallbackOpen(false);
            event.currentTarget.reset();
            await fetchStatus();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Unable to submit the document for review.');
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
                        <p>Cashfree securely checks your Aadhaar through DigiLocker and validates your driving licence against official records.</p>
                    </div>

                    <ul className="verify-list">
                        {STEPS.map((step) => {
                            const s = docStatus(verifications, step.type);
                            const meta = statusMeta(s, step.required);
                            return (
                                <li key={step.type} className={`verify-row tone-${meta.tone}`}>
                                    <div className="verify-row-mark" aria-hidden="true">
                                        {s === 'verified' ? '✓' : ['pending', 'processing'].includes(s) ? '…' : step.required ? '○' : '–'}
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

                    {docStatus(verifications, 'AADHAAR') !== 'verified' ? (
                        <button
                            type="button"
                            className="btn btn-primary verify-primary-btn"
                            onClick={handleDigiLocker}
                            disabled={actionLoading}
                        >
                            {actionLoading ? 'Connecting Cashfree…' : docStatus(verifications, 'AADHAAR') === 'processing' ? 'Continue with Cashfree' : 'Verify Aadhaar with Cashfree'}
                        </button>
                    ) : (
                        <div className="verify-success-banner">
                            Aadhaar has been verified by Cashfree.
                        </div>
                    )}
                </section>

                {manualFallbackOpen && (
                    <section className="verify-panel verify-panel-secondary" role="region" aria-label="Emergency identity review">
                        <div className="verify-panel-head">
                            <h2>Cashfree is unavailable</h2>
                            <p>Cashfree could not complete this check. As an emergency fallback, send a clear {manualDocType === 'AADHAAR' ? 'Aadhaar' : 'driving licence'} image to the PickAndSync review team. It will be stored privately and removed after the decision. Mask Aadhaar numbers before uploading.</p>
                        </div>
                        <form className="verify-rc-form verify-manual-form" onSubmit={handleManualFallback}>
                            <label className="verify-file">
                                Document image
                                <span className="verify-file-box">{manualFile?.name || 'Choose JPG, PNG, or WEBP (up to 6 MB)'}</span>
                                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setManualFile(e.target.files?.[0] || null)} required />
                            </label>
                            <button type="submit" className="btn btn-ghost verify-rc-btn" disabled={actionLoading}>
                                {actionLoading ? 'Submitting…' : 'Send for emergency review'}
                            </button>
                        </form>
                    </section>
                )}

                {docStatus(verifications, 'DL') !== 'verified' && (
                    <section className="verify-panel verify-panel-secondary">
                        <div className="verify-panel-head">
                            <h2>Verify your driving licence</h2>
                            <p>Cashfree checks the licence number and date of birth with official records. We do not save these details.</p>
                        </div>
                        <form className="verify-rc-form" onSubmit={handleDrivingLicense}>
                            <label>
                                Driving licence number
                                <input type="text" autoComplete="off" maxLength={25} required value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value.toUpperCase())} placeholder="Enter licence number" />
                            </label>
                            <label>
                                Date of birth
                                <input type="date" required value={licenseDob} onChange={(e) => setLicenseDob(e.target.value)} />
                            </label>
                            <button type="submit" className="btn btn-primary verify-rc-btn" disabled={actionLoading}>
                                {actionLoading ? 'Checking with Cashfree…' : 'Verify driving licence'}
                            </button>
                        </form>
                    </section>
                )}

                <section className="verify-panel verify-panel-secondary">
                    <div className="verify-panel-head">
                        <h2>For hosts — vehicle RC</h2>
                        <p>Preferred: upload RC when adding a vehicle on Host. You can also scan an existing plate here.</p>
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
