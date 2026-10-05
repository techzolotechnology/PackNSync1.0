import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { adminApi } from '../../api/index.js';
import { formatMoney } from '../../config/markets.js';

const STATUS = [
    { id: '', label: 'All' },
    { id: 'PENDING', label: 'Waiting to release' },
    { id: 'ON_HOLD', label: 'On hold' },
    { id: 'RELEASED', label: 'Paid to host' },
    { id: 'CANCELLED', label: 'Cancelled' },
];

const badge = (s) => ({ PENDING: 'badge-warning', ON_HOLD: 'badge-danger', RELEASED: 'badge-success' }[s] || 'badge-neutral');

/**
 * Host earnings: the host's full price, released to their wallet a set time
 * after the trip ends. Renters pay that price + the commission.
 */
export default function AdminEarnings({ onOpenUser }) {
    const [status, setStatus] = useState('');
    const [rows, setRows] = useState([]);
    const [summary, setSummary] = useState(null);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            const res = await adminApi.getEarnings(status);
            setRows(res.data.data);
            setSummary(res.data.summary);
        } catch {
            toast.error('Failed to load host earnings.');
        }
    }, [status]);

    useEffect(() => { load(); }, [load]);

    const act = async (fn, msg) => {
        setBusy(true);
        try {
            const res = await fn();
            toast.success(typeof msg === 'function' ? msg(res) : msg);
            load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Action failed.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            {summary && (
                <div className="adm-money-strip">
                    <div><span>Commission</span><strong>{summary.feePercent}%</strong><em>added on top of host price</em></div>
                    <div><span>Commission earned</span><strong>{formatMoney(summary.commissionEarned)}</strong><em>on paid bookings</em></div>
                    <div><span>Owed to hosts</span><strong>{formatMoney(summary.owedToHosts)}</strong><em>{formatMoney(summary.onHold)} on hold</em></div>
                    <div><span>Paid to hosts</span><strong>{formatMoney(summary.paidToHosts)}</strong><em>released {summary.releaseHours}h after trip end</em></div>
                </div>
            )}
            <div className="admin-search-row">
                <select className="form-input" value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: 220 }}>
                    {STATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={busy || !summary?.dueNow}
                    onClick={() => act(() => adminApi.releaseDueEarnings(), (res) => `Released ${res.data.data.released} earning(s).`)}
                    title="Runs automatically every 15 minutes too"
                >
                    Release {summary?.dueNow || 0} due now
                </button>
            </div>
            <div className="admin-table-wrap">
                <table className="admin-table">
                    <thead>
                        <tr><th>Host</th><th>Booking</th><th>Host gets</th><th>Fee</th><th>Releases</th><th>Status</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? <tr><td colSpan="7">No earnings yet.</td></tr> : rows.map((e) => {
                            const v = e.booking.listing.vehicle;
                            return (
                                <tr key={e.id}>
                                    <td><button type="button" className="adm-link-btn" onClick={() => onOpenUser(e.host.id)}>{e.host.name}</button></td>
                                    <td>
                                        {v.make} {v.model} <small className="adm-mono">{v.licensePlate}</small>
                                        <br /><small>{e.booking.renter.name} · {format(new Date(e.booking.startDate), 'd MMM')}–{format(new Date(e.booking.endDate), 'd MMM')}</small>
                                    </td>
                                    <td><strong>{formatMoney(e.amount)}</strong></td>
                                    <td>{formatMoney(e.platformFee)}</td>
                                    <td>{e.releasedAt ? format(new Date(e.releasedAt), 'd MMM, HH:mm') : format(new Date(e.releaseAt), 'd MMM, HH:mm')}</td>
                                    <td>
                                        <span className={`badge ${badge(e.status)}`}>{e.status === 'RELEASED' ? 'PAID' : e.status.replace('_', ' ')}</span>
                                        {e.note && <><br /><small>{e.note}</small></>}
                                    </td>
                                    <td className="admin-actions">
                                        {e.status === 'PENDING' && (
                                            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => {
                                                const note = window.prompt('Why hold this payout? (e.g. damage reported)');
                                                if (note) act(() => adminApi.holdEarning(e.id, note), 'On hold.');
                                            }}>Hold</button>
                                        )}
                                        {['PENDING', 'ON_HOLD'].includes(e.status) && (
                                            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => {
                                                if (window.confirm(`Pay ${formatMoney(e.amount)} to ${e.host.name}'s wallet now?`)) {
                                                    act(() => adminApi.releaseEarning(e.id), 'Paid to host wallet.');
                                                }
                                            }}>Release now</button>
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
