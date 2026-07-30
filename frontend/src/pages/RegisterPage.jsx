import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';
import { wakeApi } from '../utils/apiResilience.js';
import OtpCodeInput from '../components/OtpCodeInput.jsx';
import toast from 'react-hot-toast';
import './AuthPages.css';

const VISUAL = '/images/auth-green-road.png';
const RESEND_SECONDS = 60;
const MAX_RESENDS = 3;

export default function RegisterPage() {
    const { requestOtp, verifyOtp, isLoading } = useAuthStore();
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [form, setForm] = useState({ name: '', contact: '', otpCode: '' });
    const [error, setError] = useState('');
    const [otpChannel, setOtpChannel] = useState(null);
    const [resendLeft, setResendLeft] = useState(0);
    const [resendAttempts, setResendAttempts] = useState(0);
    const [successMsg, setSuccessMsg] = useState('');

    useEffect(() => { wakeApi(); }, []);

    useEffect(() => {
        if (step !== 2 || resendLeft <= 0) return undefined;
        const timer = setTimeout(() => setResendLeft((s) => Math.max(0, s - 1)), 1000);
        return () => clearTimeout(timer);
    }, [step, resendLeft]);

    const handleRequestOtp = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        if (!form.name || !form.contact) return setError('Name and Contact are required');

        const result = await requestOtp({ name: form.name, contact: form.contact, isRegister: true });
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
        if (!form.name || !form.contact || resendLeft > 0 || resendAttempts >= MAX_RESENDS) return;
        const result = await requestOtp({ name: form.name, contact: form.contact, isRegister: true });
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
            toast.success('Account created!');
            navigate('/trips');
        } else {
            setError(result.message);
        }
    };

    const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

    return (
        <div className="auth-page page-enter">
            <aside className="auth-visual">
                <img className="auth-visual-media" src={VISUAL} alt="" />
                <div className="auth-visual-shade" />
                <div className="auth-visual-copy">
                    <Link to="/" className="auth-brand">
                        <span className="auth-brand-mark" aria-hidden="true" />
                        PackAndSync
                    </Link>
                    <div className="auth-visual-headline">
                        <p>Join the road</p>
                        <h2>Start planning with your crew.</h2>
                        <span>Create an account to host trips, split costs, and list a car when you’re ready.</span>
                    </div>
                </div>
            </aside>

            <section className="auth-panel">
                <Link to="/" className="auth-brand auth-panel-mobile-brand">
                    <span className="auth-brand-mark" aria-hidden="true" />
                    PackAndSync
                </Link>

                <div className="auth-card">
                    <div className="auth-header">
                        <h1>Create an account</h1>
                        <p>Join PackAndSync with email or mobile — OTP only, no password.</p>
                    </div>

                    {step === 1 ? (
                        <form onSubmit={handleRequestOtp} className="auth-form">
                            <div className="form-group">
                                <label className="form-label" htmlFor="name">Full Name</label>
                                <input
                                    id="name"
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

                            <div className="form-group">
                                <label className="form-label" htmlFor="contact">Email or Mobile Number</label>
                                <input
                                    id="contact"
                                    name="contact"
                                    type="text"
                                    className="form-input"
                                    placeholder="you@example.com or +919876543210"
                                    value={form.contact}
                                    onChange={handleChange}
                                    required
                                    autoComplete="username"
                                />
                            </div>

                            {error && <p className="form-error">{error}</p>}

                            <button type="submit" className="btn btn-primary w-full" disabled={isLoading}>
                                {isLoading ? 'Sending OTP…' : 'Get OTP'}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleVerifyOtp} className="auth-form">
                            <p className="auth-hint">
                                Enter the 6-digit code sent to <strong>{form.contact}</strong>.
                                {otpChannel === 'console' ? ' OTP is printed in the backend terminal for this environment.' : ''}
                            </p>
                            {successMsg && <p className="form-success">{successMsg}</p>}

                            <div className="form-group">
                                <label className="form-label" htmlFor="otpCode">6-Digit OTP</label>
                                <OtpCodeInput
                                    value={form.otpCode}
                                    onChange={(otpCode) => setForm((f) => ({ ...f, otpCode: otpCode.replace(/\D/g, '').slice(0, 6) }))}
                                    disabled={isLoading}
                                />
                            </div>

                            {error && <p className="form-error">{error}</p>}

                            <button type="submit" className="btn btn-primary w-full" disabled={isLoading}>
                                {isLoading ? 'Verifying…' : 'Create Account'}
                            </button>

                            <div className="auth-otp-row">
                                <button
                                    type="button"
                                    className="auth-link-btn"
                                    onClick={handleResendOtp}
                                    disabled={isLoading || resendLeft > 0 || resendAttempts >= MAX_RESENDS}
                                >
                                    {resendAttempts >= MAX_RESENDS
                                        ? 'Resend limit reached'
                                        : (resendLeft > 0 ? `Resend OTP in ${resendLeft}s` : 'Resend OTP')}
                                </button>
                            </div>

                            <button type="button" className="btn btn-ghost w-full" onClick={() => setStep(1)}>
                                Back
                            </button>
                        </form>
                    )}

                    <p className="auth-footer">
                        Already have an account? <Link to="/login">Log in</Link>
                    </p>
                </div>
            </section>
        </div>
    );
}
