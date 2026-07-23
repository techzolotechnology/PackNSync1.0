import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';
import toast from 'react-hot-toast';
import './AuthPages.css';

export default function LoginPage() {
    const { requestOtp, verifyOtp, isLoading } = useAuthStore();
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [form, setForm] = useState({ contact: '', otpCode: '' });
    const [error, setError] = useState('');

    const handleRequestOtp = async (e) => {
        e.preventDefault();
        setError('');
        if (!form.contact) return setError('Email or Phone Number is required');
        
        const result = await requestOtp({ contact: form.contact, isRegister: false });
        if (result.success) {
            toast.success('OTP Sent! Check your email or phone.');
            setStep(2);
        } else {
            setError(result.message);
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setError('');
        if (!form.otpCode || form.otpCode.length !== 6) return setError('Enter a valid 6-digit OTP');

        const result = await verifyOtp({ contact: form.contact, otpCode: form.otpCode });
        if (result.success) {
            toast.success('Welcome back! 🎉');
            navigate('/trips');
        } else {
            setError(result.message);
        }
    };

    const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

    return (
        <div className="auth-page page-enter">
            <div className="auth-bg-orb" />
            <div className="auth-card card">
                <div className="auth-header">
                    <span className="auth-icon">🚗</span>
                    <h1>Welcome back</h1>
                    <p>Log in to your PackAndSync account</p>
                </div>

                {step === 1 ? (
                    <form onSubmit={handleRequestOtp} className="auth-form">
                        <div className="form-group">
                            <label className="form-label" htmlFor="contact">Email or Mobile Number</label>
                            <input id="contact" name="contact" type="text" className="form-input"
                                placeholder="you@example.com or +919876543210" value={form.contact}
                                onChange={handleChange} required autoComplete="username" />
                        </div>

                        {error && <p className="form-error">{error}</p>}

                        <button type="submit" className="btn btn-primary w-full" disabled={isLoading}>
                            {isLoading ? 'Sending OTP…' : 'Get OTP'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleVerifyOtp} className="auth-form">
                        <p style={{ textAlign: 'center', fontSize: '0.9rem', marginBottom: '1rem', color: '#6b7280' }}>
                            We sent a 6-digit code to <strong>{form.contact}</strong>
                        </p>
                        
                        <div className="form-group">
                            <label className="form-label" htmlFor="otpCode">6-Digit OTP</label>
                            <input id="otpCode" name="otpCode" type="text" className="form-input"
                                placeholder="123456" value={form.otpCode} maxLength="6"
                                onChange={handleChange} required autoComplete="one-time-code" 
                                style={{ textAlign: 'center', letterSpacing: '0.5rem', fontSize: '1.2rem' }} />
                        </div>

                        {error && <p className="form-error">{error}</p>}

                        <button type="submit" className="btn btn-primary w-full" disabled={isLoading}>
                            {isLoading ? 'Verifying…' : 'Log In'}
                        </button>
                        
                        <button type="button" className="btn btn-ghost w-full" onClick={() => setStep(1)} style={{ marginTop: '0.5rem' }}>
                            Back
                        </button>
                    </form>
                )}

                <p className="auth-footer" style={{ marginTop: '1.5rem' }}>
                    Don't have an account? <Link to="/register">Sign up</Link>
                </p>
            </div>
        </div>
    );
}
