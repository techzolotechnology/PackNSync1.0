import { useEffect, useRef } from 'react';

export default function OtpCodeInput({ value, onChange, disabled = false, inputId = 'otpCode' }) {
    const refs = useRef([]);
    const digits = Array.from({ length: 6 }, (_, i) => value?.[i] || '');

    useEffect(() => {
        if (!disabled) refs.current[0]?.focus();
    }, [disabled]);

    const writeAt = (index, char) => {
        const next = digits.slice();
        next[index] = char;
        onChange(next.join(''));
    };

    const handleInput = (index, raw) => {
        const cleaned = String(raw || '').replace(/\D/g, '');
        if (!cleaned) {
            writeAt(index, '');
            return;
        }
        const next = digits.slice();
        for (let i = 0; i < cleaned.length && index + i < 6; i += 1) {
            next[index + i] = cleaned[i];
        }
        onChange(next.join(''));
        const target = Math.min(index + cleaned.length, 5);
        refs.current[target]?.focus();
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace') {
            if (digits[index]) {
                writeAt(index, '');
                return;
            }
            if (index > 0) refs.current[index - 1]?.focus();
        } else if (e.key === 'ArrowLeft' && index > 0) {
            refs.current[index - 1]?.focus();
        } else if (e.key === 'ArrowRight' && index < 5) {
            refs.current[index + 1]?.focus();
        }
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const pasted = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6);
        if (!pasted) return;
        onChange(pasted.padEnd(6, ''));
        refs.current[Math.min(pasted.length - 1, 5)]?.focus();
    };

    return (
        <div className="auth-otp-grid" onPaste={handlePaste}>
            {digits.map((digit, index) => (
                <input
                    key={index}
                    ref={(el) => { refs.current[index] = el; }}
                    id={index === 0 ? inputId : undefined}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    className="auth-otp-cell"
                    value={digit}
                    disabled={disabled}
                    maxLength={1}
                    onChange={(e) => handleInput(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    aria-label={`OTP digit ${index + 1}`}
                />
            ))}
        </div>
    );
}
