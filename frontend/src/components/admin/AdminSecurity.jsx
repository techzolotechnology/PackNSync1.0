import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminApi } from '../../api/index.js';

/** The signed-in admin's own two-factor settings. */
export default function AdminSecurity() {
    const [status, setStatus] = useState(null);
    const [newCodes, setNewCodes] = useState(null);

    const load = useCallback(async () => {
        try {
            const res = await adminApi.mfaStatus();
            setStatus(res.data.data);
        } catch {
            setStatus(null);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const regenerate = async () => {
        const code = window.prompt('Enter a current 6-digit code from Google Authenticator to create new backup codes (old ones stop working):');
        if (!code) return;
        try {
            const res = await adminApi.mfaBackupCodes(code.trim());
            setNewCodes(res.data.data.backupCodes);
            load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not create backup codes.');
        }
    };

    const disable = async () => {
        if (status?.required && !window.confirm('Two-factor is required for admins. If you turn it off you must set it up again immediately. Continue?')) return;
        const code = window.prompt('Enter a current 6-digit code from Google Authenticator to turn two-factor off:');
        if (!code) return;
        try {
            await adminApi.mfaDisable(code.trim());
            toast.success('Two-factor turned off.');
            window.dispatchEvent(new CustomEvent('pns:admin-mfa', { detail: 'MFA_SETUP_REQUIRED' }));
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not turn off two-factor.');
        }
    };

    if (!status) return null;

    return (
        <section className="adm-security">
            <div>
                <h3>Your two-factor sign-in</h3>
                <p>
                    {status.enabled
                        ? <>Google Authenticator is <strong>on</strong>. {status.backupCodesLeft} backup code{status.backupCodesLeft === 1 ? '' : 's'} left.</>
                        : 'Google Authenticator is off.'}
                    {' '}Security alerts are emailed to the owner for admin sign-ins, payouts, refunds and role changes.
                </p>
                {status.enabled && status.backupCodesLeft <= 3 && (
                    <p className="adm-security-warn">Running low on backup codes — generate new ones.</p>
                )}
            </div>
            {status.enabled && (
                <div className="admin-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={regenerate}>New backup codes</button>
                    <button type="button" className="btn btn-danger btn-sm" onClick={disable}>Turn off</button>
                </div>
            )}
            {newCodes && (
                <div className="adm-security-codes">
                    <p><strong>New backup codes</strong> — save them now, they won&apos;t be shown again:</p>
                    <ul className="adm-mfa-codes">{newCodes.map((c) => <li key={c}>{c}</li>)}</ul>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNewCodes(null)}>Done</button>
                </div>
            )}
        </section>
    );
}
