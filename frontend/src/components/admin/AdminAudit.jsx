import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { adminApi } from '../../api/index.js';
import { downloadCsv } from '../../utils/csv.js';

const TARGETS = ['USER', 'TRIP', 'BOOKING', 'PAYMENT', 'WITHDRAWAL', 'VERIFICATION', 'VEHICLE', 'LISTING'];

/** Read-only trail of every admin action: who, what, when. */
export default function AdminAudit({ onOpenUser }) {
    const [action, setAction] = useState('');
    const [targetType, setTargetType] = useState('');
    const [rows, setRows] = useState([]);
    const [actions, setActions] = useState([]);
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await adminApi.getAudit({ action: action || undefined, targetType: targetType || undefined });
            setRows(res.data.data);
            setActions(res.data.actions || []);
        } catch {
            toast.error('Failed to load the audit log.');
        } finally {
            setLoading(false);
        }
    }, [action, targetType]);

    useEffect(() => { load(); }, [load]);

    const exportCsv = () => downloadCsv(`pickandsync-audit-${format(new Date(), 'yyyy-MM-dd')}.csv`, rows, [
        { label: 'When', value: (r) => new Date(r.createdAt).toISOString() },
        { label: 'Admin', value: (r) => r.admin?.name || 'Deleted admin' },
        { label: 'Admin email', value: (r) => r.admin?.email },
        { label: 'Action', value: (r) => r.action },
        { label: 'Target type', value: (r) => r.targetType },
        { label: 'Target id', value: (r) => r.targetId },
        { label: 'Summary', value: (r) => r.summary },
    ]);

    return (
        <>
            <div className="admin-search-row">
                <select className="form-input" value={action} onChange={(e) => setAction(e.target.value)} style={{ maxWidth: 220 }}>
                    <option value="">All actions</option>
                    {actions.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
                <select className="form-input" value={targetType} onChange={(e) => setTargetType(e.target.value)} style={{ maxWidth: 180 }}>
                    <option value="">All targets</option>
                    {TARGETS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <button type="button" className="btn btn-ghost btn-sm" onClick={exportCsv} disabled={!rows.length}>Export CSV</button>
            </div>
            <div className="admin-table-wrap">
                <table className="admin-table">
                    <thead><tr><th>When</th><th>Admin</th><th>Action</th><th>What happened</th></tr></thead>
                    <tbody>
                        {loading ? <tr><td colSpan="4">Loading…</td></tr>
                            : rows.length === 0 ? <tr><td colSpan="4">No admin actions recorded yet.</td></tr>
                                : rows.map((r) => (
                                    <tr key={r.id}>
                                        <td>{format(new Date(r.createdAt), 'MMM d, yyyy HH:mm')}</td>
                                        <td>{r.admin?.name || 'Deleted admin'}</td>
                                        <td><span className="badge badge-neutral">{r.action}</span></td>
                                        <td>
                                            {r.summary}
                                            {r.targetType === 'USER' && r.targetId && r.action !== 'USER_DELETE' && (
                                                <>
                                                    {' '}
                                                    <button type="button" className="adm-link-btn" onClick={() => onOpenUser(r.targetId)}>View user</button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                    </tbody>
                </table>
            </div>
        </>
    );
}
