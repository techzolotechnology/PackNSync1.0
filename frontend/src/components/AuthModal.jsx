import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore.js';
import { useAuthUiStore } from '../store/authUiStore.js';
import { wakeApi } from '../utils/apiResilience.js';
import OtpCodeInput from './OtpCodeInput.jsx';
import './AuthModal.css';

function safeNextPath(raw) {
    if (!raw || typeof raw !== 'string') return null;
    if (!raw.startsWith('/') || raw.startsWith('//')) return null;
    return raw;
}

const RESEND_SECONDS = 60;
const MAX_RESENDS = 3;

export default function AuthModal() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const { requestOtp, verifyOtp, isLoading } = useAuthStore();
    const { open, mode, closeAuth, setMode } = useAuthUiStore();

    const [step, setStep] = useState(1);
    const [form, setForm] = useState({ name: '', contact: '', otpCode: '' });
    const [error, setError] = useState('');
    const [otpChannel, setOtpChannel] = useState(null);
    const [resendLeft, setResendLeft] = useState(0);
    const [resendAttempts, setResendAttempts] = useState(0);
    const [successMsg, setSuccessMsg] = useState('');

    const isRegister = mode === 'register';

    useEffect(() => {
        if (!open) return undefined;
        wakeApi();
        setStep(1);
        setForm({ name: '', contact: '', otpCode: '' });
        setError('');
        setSuccessMsg('');
        setOtpChannel(null);
        setResendLeft(0);
        setResendAttempts(0);
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, [open, mode]);

    useEffect(() => {
        if (!open || step !== 2 || resendLeft <= 0) return undefined;
        const timer = setTimeout(() => setResendLeft((s) => Math.max(0, s - 1)), 1000);
        return () => clearTimeout(timer);
    }, [open, step, resendLeft]);

    if (!open) return null;

    const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

    const handleRequestOtp = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        if (isRegister && !form.name?.trim()) return setError('Name is required');
        if (!form.contact) return setError('Email or Phone Number is required');

        const result = await requestOtp({
            name: form.name,
            contact: form.contact,
            isRegister,
        });
        if (result.success) {
            setOtpChannel(result.channel || null);
            setResendLeft(RESEND_SECONDS);
            setResendAttempts(0);
            setSuccessMsg('Verification code sent. Please enter the 6-digit OTP.');
            toast.success(
                result.channel === 'console'
                    ? 'OTP is in the backend terminal — paste it below.'
                    : (result.message || 'OTP sent! Check your email or phone.'),
            );
            setStep(2);
        } else {
            setError(result.message);
        }
    };

    const handleResendOtp = async () => {
        setError('');
        setSuccessMsg('');
        if (!form.contact || resendLeft > 0 || resendAttempts >= MAX_RESENDS) return;
        if (isRegister && !form.name?.trim()) return;
        const result = await requestOtp({
            name: form.name,
            contact: form.contact,
            isRegister,
        });
        if (result.success) {
            setOtpChannel(result.channel || null);
            setResendLeft(RESEND_SECONDS);
            setResendAttempts((n) => n + 1);
            setSuccessMsg('New OTP sent successfully.');
            toast.success(result.message || 'A new OTP has been sent.');
        } else {
            setError(result.message);
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        if (!form.otpCode || form.otpCode.length !== 6) return setError('Enter a valid 6-digit OTP');

        const result = await verifyOtp({ contact: form.contact, otpCode: form.otpCode });
        if (result.success) {
            toast.success(isRegister ? 'Account created!' : 'Welcome back!');
            closeAuth();
            navigate(safeNextPath(params.get('next')) || '/trips');
        } else {
            setError(result.message);
        }
    };

    return (
        <div className="auth-modal-root" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
            <button type="button" className="auth-modal-backdrop" aria-label="Close" onClick={closeAuth} />
            <div className="auth-modal-card">
                <div className="auth-modal-glow" aria-hidden="true" />

                <button type="button" className="auth-modal-close" onClick={closeAuth} aria-label="Close">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                        <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                </button>

                <p className="auth-modal-brand">PackAndSync</p>

                <div className="auth-modal-header">
                    <h2 id="auth-modal-title" className="font-display">
                        {step === 2
                            ? 'Check your inbox'
                            : (isRegister ? 'Start syncing' : 'Welcome back')}
                    </h2>
                    <p>
                        {step === 2
                            ? `We sent a 6-digit code to ${form.contact}${otpChannel === 'console' ? ' — also check the backend terminal' : ''}.`
                            : (isRegister
                                ? 'Join with email or mobile. One-time code, no password.'
                                : 'Sign in with email or mobile. We’ll send a one-time code.')}
                    </p>
                </div>

                {step === 1 && (
                    <div className="auth-modal-switch" role="tablist" aria-label="Account type">
                        <button
                            type="button"
                            role="tab"
                            className={!isRegister ? 'active' : ''}
                            aria-selected={!isRegister}
                            onClick={() => setMode('login')}
                        >
                            Returning
                        </button>
                        <button
                            type="button"
                            role="tab"
                            className={isRegister ? 'active' : ''}
                            aria-selected={isRegister}
                            onClick={() => setMode('register')}
                        >
                            New traveler
                        </button>
                    </div>
                )}

                {step === 1 ? (
                    <form onSubmit={handleRequestOtp} className="auth-modal-form">
                        {isRegister && (
                            <div className="form-group">
                                <label className="form-label" htmlFor="auth-name">Full name</label>
                                <input
                                    id="auth-name"
                                    name="name"
                                    type="text"
                                    className="form-input"
                                    placeholder="Your name"
                                    value={form.name}
                                    onChange={handleChange}
                                    required
                                    autoComplete="name"
                                />
                            </div>
                        )}
                        <div className="form-group">
                            <label className="form-label" htmlFor="auth-contact">Email or mobile</label>
                            <input
                                id="auth-contact"
                                name="contact"
                                type="text"
                                className="form-input"
                                placeholder="you@example.com or +91…"
                                value={form.contact}
                                onChange={handleChange}
                                required
                                autoComplete="username"
                            />
                        </div>
                        {error && <p className="form-error">{error}</p>}
                        <button type="submit" className="auth-modal-main" disabled={isLoading}>
                            {isLoading ? 'Sending…' : 'Continue'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleVerifyOtp} className="auth-modal-form">
                        {successMsg && <p className="form-success">{successMsg}</p>}
                        <div className="form-group auth-modal-otp-group">
                            <label className="form-label" htmlFor="otpCode">One-time code</label>
                            <OtpCodeInput
                                value={form.otpCode}
                                onChange={(otpCode) => setForm((f) => ({ ...f, otpCode: otpCode.replace(/\D/g, '').slice(0, 6) }))}
                                disabled={isLoading}
                            />
                        </div>
                        {error && <p className="form-error">{error}</p>}
                        <button
                            type="submit"
                            className="auth-modal-main"
                            disabled={isLoading || form.otpCode.length !== 6}
                        >
                            {isLoading ? 'Verifying…' : (isRegister ? 'Create account' : 'Sign in')}
                        </button>
                        <div className="auth-modal-otp-row">
                            <button
                                type="button"
                                className="auth-modal-link"
                                onClick={handleResendOtp}
                                disabled={isLoading || resendLeft > 0 || resendAttempts >= MAX_RESENDS}
                            >
                                {resendAttempts >= MAX_RESENDS
                                    ? 'Resend limit reached'
                                    : (resendLeft > 0 ? `Resend in ${resendLeft}s` : 'Resend code')}
                            </button>
                            <span className="auth-modal-dot" aria-hidden="true">·</span>
                            <button
                                type="button"
                                className="auth-modal-link"
                                onClick={() => {
                                    setStep(1);
                                    setForm((f) => ({ ...f, otpCode: '' }));
                                    setError('');
                                    setSuccessMsg('');
                                }}
                            >
                                Change contact
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
