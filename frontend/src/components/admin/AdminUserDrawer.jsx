import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { adminApi } from '../../api/index.js';
import { formatMoney } from '../../config/markets.js';

const badge = (status) => {
    const s = String(status || '').toUpperCase();
    if (['VERIFIED', 'SUCCESS', 'PAID', 'CONFIRMED'].includes(s)) return 'badge-success';
    if (['PENDING'].includes(s)) return 'badge-warning';
    if (['REJECTED', 'FAILED', 'CANCELLED'].includes(s)) return 'badge-danger';
    return 'badge-neutral';
};

/** Slide-over with everything about one user, plus the actions support needs. */
export default function AdminUserDrawer({ userId, onClose, onBanToggle, onChanged }) {
    const [data, setData] = useState(null);

    const load = useCallback(async () => {
        try {
            const res = await adminApi.getUserDetail(userId);
            setData(res.data.data);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to load user.');
            onClose();
        }
    }, [userId, onClose]);

    useEffect(() => { setData(null); load(); }, [load]);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const grantPromo = async () => {
        const amount = window.prompt('Promo credit amount in ₹ (max 5,000). It can be spent on bookings but not withdrawn:');
        if (amount === null) return;
        const reason = window.prompt('Reason (shown to the user and kept in the audit log):');
        if (reason === null) return;
        try {
            await adminApi.grantPromo(userId, Number(amount), reason.trim());
            toast.success('Promo credit added.');
            load();
            onChanged?.();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not add credit.');
        }
    };

    const u = data?.user;

    return (
        <div className="adm-drawer-backdrop" onClick={onClose} role="presentation">
            <aside
                className="adm-drawer"
                role="dialog"
                aria-modal="true"
                aria-label={u ? `User ${u.name}` : 'User details'}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="adm-drawer-head">
                    <div>
                        <h2>{u?.name || 'Loading…'}</h2>
                        {u && <p>{u.email || u.phoneNumber || 'No contact'} · joined {format(new Date(u.createdAt), 'MMM d, yyyy')}</p>}
                    </div>
                    <button type="button" className="adm-drawer-close" onClick={onClose} aria-label="Close">×</button>
                </div>

                {!data ? (
                    <div className="adm-drawer-body"><p className="text-muted">Loading…</p></div>
                ) : (
                    <div className="adm-drawer-body">
                        <div className="adm-drawer-badges">
                            <span className={`badge ${u.isBanned ? 'badge-danger' : 'badge-success'}`}>{u.isBanned ? 'Banned' : 'Active'}</span>
                            <span className="badge badge-neutral">{u.role}</span>
                            {u.role === 'ADMIN' && (
                                <span className={`badge ${u.totpEnabled ? 'badge-success' : 'badge-warning'}`}>{u.totpEnabled ? '2FA on' : '2FA not set up'}</span>
                            )}
                            <span className={`badge ${data.verification.isFullyVerified ? 'badge-success' : 'badge-warning'}`}>
                                {data.verification.isFullyVerified ? 'KYC verified' : 'KYC incomplete'}
                            </span>
                        </div>
                        {u.isBanned && u.banReason && <p className="adm-drawer-note">Ban reason: {u.banReason}</p>}

                        <div className="adm-drawer-actions">
                            <button type="button" className="btn btn-primary btn-sm" onClick={grantPromo}>Add promo credit</button>
                            {u.role !== 'ADMIN' && (
                                <button type="button" className="btn btn-ghost btn-sm" onClick={async () => { await onBanToggle(u); load(); }}>
                                    {u.isBanned ? 'Unban' : 'Ban'}
                                </button>
                            )}
                            {u.role === 'ADMIN' && u.totpEnabled && (
                                <button
                                    type="button"
                                    className="btn btn-danger btn-sm"
                                    onClick={async () => {
                                        if (!window.confirm(`Reset two-factor for ${u.name}? Use this only if they lost their phone and backup codes. They will be signed out and must set up Google Authenticator again.`)) return;
                                        try {
                                            await adminApi.resetUserMfa(u.id);
                                            toast.success('Two-factor reset. An alert email was sent.');
                                            load();
                                        } catch (err) {
                                            toast.error(err.response?.data?.message || 'Reset failed.');
                                        }
                                    }}
                                >
                                    Reset 2FA
                                </button>
                            )}
                            <Link to={`/profile/${u.id}`} className="btn btn-ghost btn-sm">Public profile</Link>
                        </div>

                        <section className="adm-drawer-section">
                            <h3>Wallet</h3>
                            <div className="adm-drawer-stats">
                                <div><span>Cash</span><strong>{formatMoney(data.wallet.balance)}</strong></div>
                                <div><span>Promo credit</span><strong>{formatMoney(data.wallet.promoBalance)}</strong></div>
                            </div>
                            {data.wallet.transactions.length > 0 && (
                                <ul className="adm-drawer-list">
                                    {data.wallet.transactions.map((t) => (
                                        <li key={t.id}>
                                            <span>{t.type}{t.provider === 'PROMO' ? ' · promo' : ''} <small>{format(new Date(t.createdAt), 'MMM d')}</small></span>
                                            <span>
                                                {/* Failed/cancelled movements never changed the balance, so no sign */}
                                                {['FAILED', 'CANCELLED'].includes(t.status) ? '' : ['TOPUP', 'REFUND', 'ADJUST'].includes(t.type) ? '+' : '−'}
                                                {formatMoney(t.amount)}{' '}
                                                <span className={`badge ${badge(t.status)}`}>{t.status}</span>
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        <section className="adm-drawer-section">
                            <h3>Activity</h3>
                            <div className="adm-drawer-stats">
                                <div><span>Trips organized</span><strong>{u._count.organizedTrips}</strong></div>
                                <div><span>Trips joined</span><strong>{u._count.memberships}</strong></div>
                                <div><span>Vehicles</span><strong>{u._count.vehicles}</strong></div>
                                <div><span>Rentals booked</span><strong>{u._count.rentalBookings}</strong></div>
                            </div>
                            {data.bookings.length > 0 && (
                                <ul className="adm-drawer-list">
                                    {data.bookings.map((b) => (
                                        <li key={b.id}>
                                            <span>{b.listing?.vehicle?.make} {b.listing?.vehicle?.model} <small>{format(new Date(b.startDate), 'MMM d')}</small></span>
                                            <span>{formatMoney(b.totalPrice)} <span className={`badge ${badge(b.status)}`}>{b.status}</span></span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        <section className="adm-drawer-section">
                            <h3>Identity documents</h3>
                            {data.verification.documents.length === 0 ? <p className="text-muted">Nothing submitted.</p> : (
                                <ul className="adm-drawer-list">
                                    {data.verification.documents.map((d) => (
                                        <li key={d.id}>
                                            <span>{d.documentType} <small>{format(new Date(d.createdAt), 'MMM d')}</small></span>
                                            <span>
                                                <span className={`badge ${badge(d.status)}`}>{d.status}</span>
                                                {d.rejectionReason && <small> · {d.rejectionReason}</small>}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        <section className="adm-drawer-section">
                            <h3>Referrals</h3>
                            <div className="adm-drawer-stats">
                                <div><span>Invited by</span><strong>{u.referredBy?.name || '—'}</strong></div>
                                <div><span>Friends referred</span><strong>{u._count.referrals}</strong></div>
                                <div><span>Referral code</span><strong className="adm-mono">{u.referralCode || '—'}</strong></div>
                            </div>
                        </section>

                        <section className="adm-drawer-section">
                            <h3>Admin history</h3>
                            {data.audit.length === 0 ? <p className="text-muted">No admin actions on this account.</p> : (
                                <ul className="adm-drawer-list">
                                    {data.audit.map((a) => (
                                        <li key={a.id}>
                                            <span>{a.summary}</span>
                                            <small>{a.admin?.name || 'Deleted admin'} · {format(new Date(a.createdAt), 'MMM d, HH:mm')}</small>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    </div>
                )}
            </aside>
        </div>
    );
}
