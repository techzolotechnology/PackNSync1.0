import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { adminApi } from '../../api/index.js';
import { formatMoney } from '../../config/markets.js';

function payoutTarget(tx) {
    const m = tx.metadata || {};
    if (m.mode === 'upi') return { label: 'UPI', value: m.upiId };
    if (m.mode === 'bank') return { label: `Bank · ${m.ifsc || ''}`, value: m.accountNumber };
    return { label: '—', value: '' };
}

/**
 * Withdrawals queue. When Cashfree Payouts is not configured, withdrawals wait
 * here with the money held; an admin pays out by UPI/bank and records the UTR,
 * or rejects the request and the money returns to the user's wallet.
 */
export default function AdminWithdrawals({ onChanged }) {
    const [status, setStatus] = useState('PENDING');
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [busyId, setBusyId] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await adminApi.getWithdrawals(status);
            setRows(res.data.data);
        } catch {
            toast.error('Failed to load withdrawals.');
        } finally {
            setLoading(false);
        }
    }, [status]);

    useEffect(() => { load(); }, [load]);

    const complete = async (tx) => {
        const target = payoutTarget(tx);
        const reference = window.prompt(
            `Pay ${formatMoney(tx.amount)} to ${tx.metadata?.accountName || tx.wallet?.user?.name} (${target.label} ${target.value}), then enter the UTR / transfer reference:`,
        );
        if (reference === null) return;
        setBusyId(tx.id);
        try {
            await adminApi.completeWithdrawal(tx.id, reference.trim());
            toast.success('Marked as paid. The user has been notified.');
            load();
            onChanged?.();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not mark as paid.');
        } finally {
            setBusyId(null);
        }
    };

    const reject = async (tx) => {
        const reason = window.prompt('Why is this withdrawal rejected? The user will see this, and the money goes back to their wallet.');
        if (reason === null) return;
        setBusyId(tx.id);
        try {
            await adminApi.rejectWithdrawal(tx.id, reason.trim());
            toast.success('Rejected. Money returned to the wallet.');
            load();
            onChanged?.();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not reject.');
        } finally {
            setBusyId(null);
        }
    };

    const pendingTotal = rows.filter((r) => r.status === 'PENDING').reduce((s, r) => s + r.amount, 0);

    return (
        <>
            <div className="admin-search-row">
                <select className="form-input" value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: 200 }}>
                    <option value="PENDING">Waiting for payout</option>
                    <option value="SUCCESS">Paid</option>
                    <option value="FAILED">Rejected / failed</option>
                    <option value="ALL">All</option>
                </select>
                {status === 'PENDING' && rows.length > 0 && (
                    <span className="adm-inline-note">{rows.length} waiting · {formatMoney(pendingTotal)} held</span>
                )}
            </div>
            <div className="admin-table-wrap">
                <table className="admin-table">
                    <thead>
                        <tr><th>User</th><th>Amount</th><th>Pay to</th><th>Requested</th><th>Status</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                        {loading ? <tr><td colSpan="6">Loading…</td></tr>
                            : rows.length === 0 ? <tr><td colSpan="6">{status === 'PENDING' ? 'No withdrawals waiting. 🎉' : 'No records.'}</td></tr>
                                : rows.map((tx) => {
                                    const target = payoutTarget(tx);
                                    return (
                                        <tr key={tx.id}>
                                            <td>{tx.wallet?.user?.name}<br /><small>{tx.wallet?.user?.email}</small></td>
                                            <td><strong>{formatMoney(tx.amount)}</strong></td>
                                            <td>
                                                {target.label}<br />
                                                <small className="adm-mono">{target.value}</small>
                                                {tx.metadata?.accountName && <><br /><small>{tx.metadata.accountName}</small></>}
                                            </td>
                                            <td>{format(new Date(tx.createdAt), 'MMM d, yyyy HH:mm')}</td>
                                            <td>
                                                <span className={`badge ${tx.status === 'SUCCESS' ? 'badge-success' : tx.status === 'PENDING' ? 'badge-warning' : 'badge-danger'}`}>
                                                    {tx.status === 'SUCCESS' ? 'PAID' : tx.status}
                                                </span>
                                                {tx.metadata?.manualSettlement?.reference && (
                                                    <><br /><small>UTR {tx.metadata.manualSettlement.reference}</small></>
                                                )}
                                            </td>
                                            <td className="admin-actions">
                                                {tx.status === 'PENDING' && (
                                                    <>
                                                        <button type="button" className="btn btn-primary btn-sm" disabled={busyId === tx.id} onClick={() => complete(tx)}>
                                                            Mark paid
                                                        </button>
                                                        <button type="button" className="btn btn-danger btn-sm" disabled={busyId === tx.id} onClick={() => reject(tx)}>
                                                            Reject
                                                        </button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                    </tbody>
                </table>
            </div>
        </>
    );
}
