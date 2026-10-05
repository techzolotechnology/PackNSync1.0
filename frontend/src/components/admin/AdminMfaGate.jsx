import { useCallback, useEffect, useState } from 'react';
import qrcode from 'qrcode-generator';
import toast from 'react-hot-toast';
import { adminApi } from '../../api/index.js';
import { useAuthStore } from '../../store/authStore.js';

/** Store the upgraded (2FA-verified) tokens the same way login does. */
function storeTokens({ accessToken, refreshToken }) {
    if (accessToken) localStorage.setItem('access_token', accessToken);
    if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
    const { user, setUser } = useAuthStore.getState();
    if (user && accessToken) setUser(user, accessToken);
}

function qrDataUrl(text) {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    return qr.createDataURL(5, 8);
}

function BackupCodes({ codes, onDone }) {
    const text = codes.join('\n');
    const download = () => {
        const blob = new Blob([`PickAndSync admin backup codes\nEach code works once.\n\n${text}\n`], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'pickandsync-admin-backup-codes.txt';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    return (
        <div className="adm-mfa-card">
            <h2>Save your backup codes</h2>
            <p>If you lose your phone, each of these codes lets you sign in once. They won&apos;t be shown again.</p>
            <ul className="adm-mfa-codes">{codes.map((c) => <li key={c}>{c}</li>)}</ul>
            <div className="adm-mfa-actions">
                <button type="button" className="btn btn-ghost" onClick={() => navigator.clipboard?.writeText(text).then(() => toast.success('Copied'))}>Copy</button>
                <button type="button" className="btn btn-ghost" onClick={download}>Download .txt</button>
                <button type="button" className="btn btn-primary" onClick={onDone}>I&apos;ve saved them</button>
            </div>
        </div>
    );
}

/**
 * Admin panel requires Google Authenticator (or any TOTP app). This gate
 * enrolls first-time admins and asks for a code at the start of each
 * 2FA session (default 12 hours). The API enforces the same rule.
 */
export default function AdminMfaGate({ children }) {
    const [state, setState] = useState('loading'); // loading | setup | enroll | verify | codes | ok
    const [enrollment, setEnrollment] = useState(null);
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [backupCodes, setBackupCodes] = useState([]);

    const check = useCallback(async () => {
        try {
            const res = await adminApi.mfaStatus();
            const s = res.data.data;
            if (!s.required || s.verified) setState('ok');
            else setState(s.enabled ? 'verify' : 'setup');
        } catch {
            setState('verify');
        }
    }, []);

    useEffect(() => { check(); }, [check]);

    // The API interceptor raises this when a 2FA session expires mid-use.
    useEffect(() => {
        const onExpired = (e) => setState(e.detail === 'MFA_SETUP_REQUIRED' ? 'setup' : 'verify');
        window.addEventListener('pns:admin-mfa', onExpired);
        return () => window.removeEventListener('pns:admin-mfa', onExpired);
    }, []);

    const startSetup = async () => {
        setBusy(true);
        try {
            const res = await adminApi.mfaSetup();
            setEnrollment({ ...res.data.data, qr: qrDataUrl(res.data.data.otpauthUrl) });
            setState('enroll');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not start setup.');
        } finally {
            setBusy(false);
        }
    };

    const submit = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            if (state === 'enroll') {
                const res = await adminApi.mfaEnable(code.trim());
                storeTokens(res.data.data);
                setBackupCodes(res.data.data.backupCodes);
                setState('codes');
            } else {
                const res = await adminApi.mfaVerify(code.trim());
                storeTokens(res.data.data);
                if (res.data.data.usedBackupCode) {
                    toast(`Backup code used. ${res.data.data.backupCodesLeft} left — set up a new phone soon.`, { duration: 8000 });
                }
                setState('ok');
            }
            setCode('');
        } catch (err) {
            toast.error(err.response?.data?.message || 'That code did not work.');
        } finally {
            setBusy(false);
        }
    };

    if (state === 'ok') return children;
    if (state === 'loading') return <div className="adm-mfa-wrap"><p className="text-muted">Checking security…</p></div>;
    if (state === 'codes') return <div className="adm-mfa-wrap"><BackupCodes codes={backupCodes} onDone={() => setState('ok')} /></div>;

    return (
        <div className="adm-mfa-wrap">
            <div className="adm-mfa-card">
                {state === 'setup' && (
                    <>
                        <h2>Protect the admin panel</h2>
                        <p>
                            Admin accounts must use <strong>Google Authenticator</strong> (or Microsoft Authenticator, Authy…).
                            It takes a minute: install the app on your phone, then continue.
                        </p>
                        <button type="button" className="btn btn-primary" onClick={startSetup} disabled={busy}>
                            {busy ? 'Starting…' : 'Set up Google Authenticator'}
                        </button>
                    </>
                )}

                {state === 'enroll' && enrollment && (
                    <>
                        <h2>Scan this QR code</h2>
                        <ol className="adm-mfa-steps">
                            <li>Open Google Authenticator and tap <strong>+</strong> → <strong>Scan a QR code</strong>.</li>
                            <li>Scan the code below (or tap <em>Enter a setup key</em> and type the key).</li>
                            <li>Enter the 6-digit code the app shows.</li>
                        </ol>
                        <img className="adm-mfa-qr" src={enrollment.qr} alt="QR code for Google Authenticator" />
                        <p className="adm-mfa-key">
                            Setup key: <code>{enrollment.secret.match(/.{1,4}/g).join(' ')}</code>
                        </p>
                        <a className="adm-mfa-applink" href={enrollment.otpauthUrl}>On this phone? Open in authenticator app</a>
                    </>
                )}

                {state === 'verify' && (
                    <>
                        <h2>Two-factor check</h2>
                        <p>Enter the 6-digit code from Google Authenticator. Lost your phone? Use one of your backup codes.</p>
                    </>
                )}

                {(state === 'enroll' || state === 'verify') && (
                    <form className="adm-mfa-form" onSubmit={submit}>
                        <input
                            className="form-input"
                            inputMode={state === 'enroll' ? 'numeric' : 'text'}
                            autoComplete="one-time-code"
                            autoFocus
                            maxLength={state === 'enroll' ? 6 : 11}
                            placeholder={state === 'enroll' ? '123456' : '123456 or backup code'}
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            aria-label="Authenticator code"
                        />
                        <button type="submit" className="btn btn-primary" disabled={busy || code.trim().length < 6}>
                            {busy ? 'Checking…' : state === 'enroll' ? 'Turn on two-factor' : 'Continue'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
