import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { adminApi } from '../../api/index.js';
import { formatMoney } from '../../config/markets.js';
import { downloadCsv } from '../../utils/csv.js';

const TYPES = ['TOPUP', 'SPEND', 'REFUND', 'WITHDRAW', 'ADJUST'];
const STATUSES = ['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED'];
const INFLOW = new Set(['TOPUP', 'REFUND', 'ADJUST']);
/** Failed/cancelled rows never moved money (a failed withdrawal was refunded). */
const settledNothing = (r) => r.status === 'FAILED' || r.status === 'CANCELLED';

/** Every wallet movement across all users, filterable and exportable. */
export default function AdminLedger() {
    const [type, setType] = useState('');
    const [status, setStatus] = useState('');
    const [q, setQ] = useState('');
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await adminApi.getWalletTransactions({ type: type || undefined, status: status || undefined, q: q || undefined });
            setRows(res.data.data);
        } catch {
            toast.error('Failed to load wallet transactions.');
        } finally {
            setLoading(false);
        }
    }, [type, status, q]);

    useEffect(() => {
        const t = setTimeout(load, 300); // debounce typing in the search box
        return () => clearTimeout(t);
    }, [load]);

    const exportCsv = () => downloadCsv(`pickandsync-wallet-${format(new Date(), 'yyyy-MM-dd')}.csv`, rows, [
        { label: 'Date', value: (r) => new Date(r.createdAt).toISOString() },
        { label: 'User', value: (r) => r.wallet?.user?.name },
        { label: 'Email', value: (r) => r.wallet?.user?.email },
        { label: 'Type', value: (r) => r.type },
        { label: 'Status', value: (r) => r.status },
        { label: 'Amount (INR)', value: (r) => r.amount },
        { label: 'Promo used (INR)', value: (r) => r.metadata?.promoUsed || 0 },
        { label: 'Cash balance after', value: (r) => r.balanceAfter },
        { label: 'Provider', value: (r) => r.provider },
        { label: 'Reference', value: (r) => r.referenceId },
        { label: 'Description', value: (r) => r.description },
    ]);

    return (
        <>
            <div className="admin-search-row">
                <input
                    type="search"
                    className="form-input"
                    placeholder="Search user, email or reference…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    style={{ maxWidth: 260 }}
                />
                <select className="form-input" value={type} onChange={(e) => setType(e.target.value)} style={{ maxWidth: 160 }}>
                    <option value="">All types</option>
                    {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <select className="form-input" value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: 160 }}>
                    <option value="">All statuses</option>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <button type="button" className="btn btn-ghost btn-sm" onClick={exportCsv} disabled={!rows.length}>
                    Export CSV
                </button>
            </div>
            <div className="admin-table-wrap">
                <table className="admin-table">
                    <thead>
                        <tr><th>Date</th><th>User</th><th>Type</th><th>Amount</th><th>Status</th><th>Details</th></tr>
                    </thead>
                    <tbody>
                        {loading && rows.length === 0 ? <tr><td colSpan="6">Loading…</td></tr>
                            : rows.length === 0 ? <tr><td colSpan="6">No transactions match.</td></tr>
                                : rows.map((r) => (
                                    <tr key={r.id}>
                                        <td>{format(new Date(r.createdAt), 'MMM d, HH:mm')}</td>
                                        <td>{r.wallet?.user?.name}<br /><small>{r.wallet?.user?.email}</small></td>
                                        <td>{r.type}{r.provider === 'PROMO' ? ' · promo' : ''}</td>
                                        <td className={settledNothing(r) ? 'adm-amount-void' : INFLOW.has(r.type) ? 'adm-amount-in' : 'adm-amount-out'}>
                                            {settledNothing(r) ? '' : INFLOW.has(r.type) ? '+' : '−'}{formatMoney(r.amount)}
                                            {r.metadata?.promoUsed ? <><br /><small>{formatMoney(r.metadata.promoUsed)} from promo</small></> : null}
                                        </td>
                                        <td>
                                            <span className={`badge ${r.status === 'SUCCESS' ? 'badge-success' : r.status === 'PENDING' ? 'badge-warning' : 'badge-danger'}`}>
                                                {r.status}
                                            </span>
                                        </td>
                                        <td><small>{r.description || '—'}</small><br /><small className="adm-mono">{r.referenceId}</small></td>
                                    </tr>
                                ))}
                    </tbody>
                </table>
            </div>
            {rows.length >= 200 && <p className="adm-inline-note">Showing the latest 200. Narrow the filters to see older entries.</p>}
        </>
    );
}
