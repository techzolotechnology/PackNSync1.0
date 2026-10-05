import { useCallback, useEffect, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { adminApi } from '../../api/index.js';
import { formatMoney } from '../../config/markets.js';

const OUTCOME_TEXT = {
    credited: 'Paid — money added to the wallet',
    failed: 'Payment failed at Cashfree — marked failed',
    cancelled: 'Abandoned — cancelled',
    still_pending: 'Still pending at Cashfree',
    not_pending: 'Already settled',
};

/**
 * Top-ups stuck in PENDING (user closed the payment page, webhook missed…).
 * Re-checking asks Cashfree for the real status and settles it. The server
 * also does this automatically every 15 minutes.
 */
export default function AdminStuckTopups() {
    const [rows, setRows] = useState([]);
    const [busyId, setBusyId] = useState(null);

    const load = useCallback(async () => {
        try {
            const res = await adminApi.getStuckTopups();
            setRows(res.data.data);
        } catch {
            toast.error('Failed to load stuck top-ups.');
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const recheck = async (id) => {
        setBusyId(id);
        try {
            const res = await adminApi.recheckTopup(id);
            toast(OUTCOME_TEXT[res.data.data.outcome] || res.data.data.outcome);
            load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Re-check failed.');
        } finally {
            setBusyId(null);
        }
    };

    const recheckAll = async () => {
        setBusyId('all');
        try {
            const res = await adminApi.recheckAllTopups();
            const d = res.data.data;
            toast.success(`Checked ${d.checked}: ${d.credited || 0} credited, ${d.failed || 0} failed, ${d.cancelled || 0} cancelled, ${d.still_pending || 0} still pending.`);
            load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Re-check failed.');
        } finally {
            setBusyId(null);
        }
    };

    return (
        <>
            <div className="admin-search-row">
                <span className="adm-inline-note">
                    Top-ups still pending after 30 minutes. Paid ones are credited, failed ones closed; unpaid ones are cancelled after 3 days.
                </span>
                <button type="button" className="btn btn-primary btn-sm" disabled={!rows.length || busyId === 'all'} onClick={recheckAll}>
                    {busyId === 'all' ? 'Checking…' : 'Re-check all with Cashfree'}
                </button>
            </div>
            <div className="admin-table-wrap">
                <table className="admin-table">
                    <thead><tr><th>User</th><th>Amount</th><th>Order</th><th>Started</th><th>Actions</th></tr></thead>
                    <tbody>
                        {rows.length === 0 ? <tr><td colSpan="5">No stuck top-ups. 🎉</td></tr> : rows.map((t) => (
                            <tr key={t.id}>
                                <td>{t.wallet?.user?.name}<br /><small>{t.wallet?.user?.email}</small></td>
                                <td><strong>{formatMoney(t.amount)}</strong></td>
                                <td><small className="adm-mono">{t.referenceId}</small></td>
                                <td>{format(new Date(t.createdAt), 'd MMM, HH:mm')}<br /><small>{formatDistanceToNow(new Date(t.createdAt), { addSuffix: true })}</small></td>
                                <td>
                                    <button type="button" className="btn btn-ghost btn-sm" disabled={busyId === t.id} onClick={() => recheck(t.id)}>
                                        {busyId === t.id ? 'Checking…' : 'Re-check'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    );
}
