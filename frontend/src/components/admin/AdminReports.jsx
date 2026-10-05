import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { adminApi, reportsApi } from '../../api/index.js';
import { formatMoney } from '../../config/markets.js';
import { REPORT_CATEGORY_LABELS, REPORT_STATUS_LABELS } from '../../pages/reportLabels.js';

const STATUS_FILTERS = [
    { id: 'ACTIVE', label: 'Open & in review' },
    { id: 'OPEN', label: 'Open' },
    { id: 'IN_REVIEW', label: 'In review' },
    { id: 'RESOLVED', label: 'Resolved' },
    { id: 'DISMISSED', label: 'Dismissed' },
    { id: 'ALL', label: 'All' },
];

function statusBadge(status) {
    if (status === 'OPEN') return 'badge-warning';
    if (status === 'IN_REVIEW') return 'badge-info';
    if (status === 'RESOLVED') return 'badge-success';
    return 'badge-neutral';
}

async function openEvidence(url) {
    const tab = window.open('', '_blank');
    try {
        const res = await reportsApi.evidenceBlob(url);
        const objectUrl = URL.createObjectURL(res.data);
        if (tab) tab.location.href = objectUrl;
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch {
        tab?.close();
        toast.error('Photo not found (it may have been lost in a server redeploy).');
    }
}

function ReportDetail({ id, onChanged, onOpenUser }) {
    const [report, setReport] = useState(null);
    const [reply, setReply] = useState('');
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            const res = await adminApi.getReport(id);
            setReport(res.data.data);
        } catch {
            toast.error('Failed to load report.');
        }
    }, [id]);

    useEffect(() => { setReport(null); load(); }, [load]);

    const run = async (fn, success) => {
        setBusy(true);
        try {
            await fn();
            if (success) toast.success(success);
            await load();
            onChanged();
            return true;
        } catch (err) {
            toast.error(err.response?.data?.message || 'Action failed.');
            return false;
        } finally {
            setBusy(false);
        }
    };

    const close = (status) => {
        const resolution = window.prompt(status === 'RESOLVED'
            ? 'What was decided? (The customer will see this.)'
            : 'Why is this report being dismissed? (The customer will see this.)');
        if (!resolution) return;
        run(() => adminApi.updateReport(id, { status, resolution }), status === 'RESOLVED' ? 'Report resolved.' : 'Report dismissed.');
    };

    if (!report) return <div className="adm-report-detail"><p className="text-muted">Loading…</p></div>;
    const open = ['OPEN', 'IN_REVIEW'].includes(report.status);
    const earning = report.booking?.hostEarning;

    return (
        <div className="adm-report-detail">
            <div className="adm-report-head">
                <div>
                    <span className={`badge ${report.priority === 'HIGH' ? 'badge-danger' : 'badge-neutral'}`}>{report.priority}</span>{' '}
                    <span className={`badge ${statusBadge(report.status)}`}>{REPORT_STATUS_LABELS[report.status]}</span>
                    <h3>{report.subject}</h3>
                    <p>
                        {REPORT_CATEGORY_LABELS[report.category]} · by{' '}
                        <button type="button" className="adm-link-btn" onClick={() => onOpenUser(report.reporter.id)}>{report.reporter.name}</button>
                        {' '}· {format(new Date(report.createdAt), 'd MMM yyyy, HH:mm')}
                        {report.assignedAdmin && <> · handled by {report.assignedAdmin.name}</>}
                    </p>
                </div>
            </div>

            {/* What the report is about, with the actions an admin usually needs */}
            {report.target && (
                <div className="adm-report-box">
                    <div>
                        <strong>Reported {report.target.type.toLowerCase()}:</strong> {report.target.label}
                        {report.target.sub && <small> · {report.target.sub}</small>}
                    </div>
                    <div className="admin-actions">
                        {report.target.type === 'USER' && (
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onOpenUser(report.target.id)}>
                                Open user {report.target.isBanned ? '(banned)' : ''}
                            </button>
                        )}
                        {report.target.type === 'LISTING' && (
                            <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                disabled={busy || !report.target.isActive}
                                onClick={() => run(() => adminApi.setListingActive(report.target.id, false), 'Listing deactivated.')}
                            >
                                {report.target.isActive ? 'Deactivate listing' : 'Listing inactive'}
                            </button>
                        )}
                        {report.target.type === 'TRIP' && (
                            <Link to={`/trips/${report.target.id}`} className="btn btn-ghost btn-sm">Open trip</Link>
                        )}
                    </div>
                </div>
            )}

            {report.booking && (
                <div className="adm-report-box">
                    <div>
                        <strong>Booking:</strong> {report.booking.listing.vehicle.make} {report.booking.listing.vehicle.model} ({report.booking.listing.vehicle.licensePlate})
                        {' '}· {format(new Date(report.booking.startDate), 'd MMM')}–{format(new Date(report.booking.endDate), 'd MMM')}
                        {' '}· <span className={`badge ${report.booking.status === 'PAID' ? 'badge-success' : 'badge-neutral'}`}>{report.booking.status}</span>
                    </div>
                    <div className="adm-report-people">
                        Renter <button type="button" className="adm-link-btn" onClick={() => onOpenUser(report.booking.renter.id)}>{report.booking.renter.name}</button>
                        {' '}· Host <button type="button" className="adm-link-btn" onClick={() => onOpenUser(report.booking.listing.host.id)}>{report.booking.listing.host.name}</button>
                    </div>
                    <div className="adm-report-money">
                        Paid {formatMoney(report.booking.totalPrice)}
                        {report.booking.platformFee > 0 && <> (host {formatMoney(report.booking.hostAmount)} + fee {formatMoney(report.booking.platformFee)})</>}
                        {earning && (
                            <> · host payout <span className={`badge ${earning.status === 'ON_HOLD' ? 'badge-warning' : earning.status === 'RELEASED' ? 'badge-success' : 'badge-neutral'}`}>{earning.status}</span></>
                        )}
                    </div>
                    <div className="admin-actions">
                        {earning?.status === 'PENDING' && (
                            <button type="button" className="btn btn-ghost btn-sm" disabled={busy}
                                onClick={() => run(() => adminApi.holdEarning(earning.id, `Report: ${report.subject}`), 'Host payout on hold.')}>
                                Hold host payout
                            </button>
                        )}
                        {earning?.status === 'ON_HOLD' && (
                            <button type="button" className="btn btn-ghost btn-sm" disabled={busy}
                                onClick={() => run(() => adminApi.releaseEarning(earning.id, 'Released after report review'), 'Paid to host.')}>
                                Release to host
                            </button>
                        )}
                        {report.payment?.status === 'succeeded' && (
                            <button type="button" className="btn btn-danger btn-sm" disabled={busy}
                                onClick={() => window.confirm(`Refund ${formatMoney(report.payment.amount)} to the renter and cancel the booking?`)
                                    && run(() => adminApi.refundPayment(report.payment.id), 'Refunded to renter wallet.')}>
                                Refund renter
                            </button>
                        )}
                    </div>
                </div>
            )}

            {report.evidence?.length > 0 && (
                <div className="adm-report-box">
                    <div>
                        <strong>Photos:</strong>{' '}
                        {report.evidence.map((url, i) => (
                            <button key={url} type="button" className="adm-link-btn" onClick={() => openEvidence(url)}>Photo {i + 1}</button>
                        )).reduce((acc, el) => (acc.length ? [...acc, ' · ', el] : [el]), [])}
                    </div>
                </div>
            )}

            <ol className="adm-report-thread">
                {report.messages.map((m) => (
                    <li key={m.id} className={m.fromAdmin ? 'is-admin' : ''}>
                        <strong>{m.fromAdmin ? `${m.author?.name || 'Admin'} (support)` : m.author?.name || 'Customer'}</strong>
                        <p>{m.body}</p>
                        <time>{format(new Date(m.createdAt), 'd MMM, HH:mm')}</time>
                    </li>
                ))}
            </ol>

            {open ? (
                <>
                    <form
                        className="adm-report-reply"
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (!reply.trim()) return;
                            run(() => adminApi.replyReport(id, reply.trim()), 'Reply sent.').then((ok) => ok && setReply(''));
                        }}
                    >
                        <textarea className="form-input" rows={3} placeholder="Reply to the customer…" value={reply} onChange={(e) => setReply(e.target.value)} />
                        <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !reply.trim()}>Send reply</button>
                    </form>
                    <div className="admin-actions">
                        {!report.assignedAdmin && (
                            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => run(() => adminApi.updateReport(id, { assignToMe: true, status: 'IN_REVIEW' }), 'Assigned to you.')}>
                                Take this report
                            </button>
                        )}
                        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => close('RESOLVED')}>Resolve</button>
                        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => close('DISMISSED')}>Dismiss</button>
                    </div>
                </>
            ) : (
                <div className="adm-report-box"><div><strong>Decision:</strong> {report.resolution}</div></div>
            )}
        </div>
    );
}

/** Reports & disputes queue: high priority first, then oldest waiting. */
export default function AdminReports({ onOpenUser, onChanged, initialSelected = null }) {
    const [status, setStatus] = useState(initialSelected ? 'ALL' : 'ACTIVE');
    const [rows, setRows] = useState([]);
    const [counts, setCounts] = useState({});
    const [selected, setSelected] = useState(initialSelected);
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await adminApi.getReports({ status });
            setRows(res.data.data);
            setCounts(res.data.counts || {});
        } catch {
            toast.error('Failed to load reports.');
        } finally {
            setLoading(false);
        }
    }, [status]);

    useEffect(() => { load(); }, [load]);

    return (
        <>
            <div className="admin-search-row">
                <select className="form-input" value={status} onChange={(e) => { setStatus(e.target.value); setSelected(null); }} style={{ maxWidth: 220 }}>
                    {STATUS_FILTERS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
                <span className="adm-inline-note">
                    {counts.OPEN || 0} open · {counts.IN_REVIEW || 0} in review · {counts.RESOLVED || 0} resolved
                </span>
            </div>
            <div className={`adm-reports-layout ${selected ? 'has-detail' : ''}`}>
                <ul className="adm-report-list">
                    {loading && !rows.length ? <li className="text-muted">Loading…</li>
                        : rows.length === 0 ? <li className="text-muted">No reports here. 🎉</li>
                            : rows.map((r) => (
                                <li key={r.id}>
                                    <button type="button" className={`adm-report-item ${selected === r.id ? 'is-active' : ''}`} onClick={() => setSelected(r.id)}>
                                        <span>
                                            {r.priority === 'HIGH' && <span className="badge badge-danger">HIGH</span>}{' '}
                                            <span className={`badge ${statusBadge(r.status)}`}>{REPORT_STATUS_LABELS[r.status]}</span>
                                        </span>
                                        <strong>{r.subject}</strong>
                                        <small>{REPORT_CATEGORY_LABELS[r.category]} · {r.reporter.name} · {format(new Date(r.createdAt), 'd MMM')} · {r._count.messages} msg</small>
                                    </button>
                                </li>
                            ))}
                </ul>
                {selected ? (
                    <ReportDetail id={selected} onOpenUser={onOpenUser} onChanged={() => { load(); onChanged?.(); }} />
                ) : (
                    <div className="adm-report-detail adm-report-empty"><p className="text-muted">Select a report.</p></div>
                )}
            </div>
        </>
    );
}
