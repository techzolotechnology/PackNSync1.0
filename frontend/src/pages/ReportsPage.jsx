import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { reportsApi } from '../api/index.js';
import { REPORT_CATEGORY_LABELS, REPORT_STATUS_LABELS } from './reportLabels.js';
import './Reports.css';

const OPEN = ['OPEN', 'IN_REVIEW'];

/** Private evidence photo: fetched with the user's token. */
function EvidenceImage({ url }) {
    const [src, setSrc] = useState(null);
    useEffect(() => {
        let objectUrl;
        reportsApi.evidenceBlob(url)
            .then((res) => { objectUrl = URL.createObjectURL(res.data); setSrc(objectUrl); })
            .catch(() => setSrc(null));
        return () => objectUrl && URL.revokeObjectURL(objectUrl);
    }, [url]);
    if (!src) return <div className="rpt-photo rpt-photo-missing">Photo</div>;
    return <a href={src} target="_blank" rel="noreferrer" className="rpt-photo"><img src={src} alt="Evidence" /></a>;
}

function ReportDetail({ id, onChanged }) {
    const [report, setReport] = useState(null);
    const [reply, setReply] = useState('');
    const [sending, setSending] = useState(false);

    const load = useCallback(async () => {
        try {
            const res = await reportsApi.get(id);
            setReport(res.data.data);
        } catch {
            toast.error('Report not found.');
        }
    }, [id]);

    useEffect(() => { load(); }, [load]);

    const send = async (e) => {
        e.preventDefault();
        if (!reply.trim()) return;
        setSending(true);
        try {
            await reportsApi.reply(id, reply.trim());
            setReply('');
            await load();
            onChanged();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not send.');
        } finally {
            setSending(false);
        }
    };

    if (!report) return <div className="rpt-detail"><p className="text-muted">Loading…</p></div>;
    const isOpen = OPEN.includes(report.status);

    return (
        <article className="rpt-detail">
            <Link to="/reports" className="rpt-back">← All reports</Link>
            <header>
                <span className={`rpt-status rpt-status-${report.status.toLowerCase()}`}>{REPORT_STATUS_LABELS[report.status]}</span>
                <h2>{report.subject}</h2>
                <p className="rpt-meta">
                    {REPORT_CATEGORY_LABELS[report.category]} · filed {format(new Date(report.createdAt), 'd MMM yyyy, HH:mm')}
                    {report.booking && <> · {report.booking.listing.vehicle.make} {report.booking.listing.vehicle.model} booking</>}
                </p>
            </header>

            {report.evidence?.length > 0 && (
                <div className="rpt-photos">{report.evidence.map((url) => <EvidenceImage key={url} url={url} />)}</div>
            )}

            <ol className="rpt-thread">
                {report.messages.map((m) => (
                    <li key={m.id} className={m.fromAdmin ? 'from-support' : 'from-you'}>
                        <strong>{m.fromAdmin ? 'PickAndSync support' : 'You'}</strong>
                        <p>{m.body}</p>
                        <time>{format(new Date(m.createdAt), 'd MMM, HH:mm')}</time>
                    </li>
                ))}
            </ol>

            {report.resolution && !isOpen && (
                <div className="rpt-resolution"><strong>Decision:</strong> {report.resolution}</div>
            )}

            {isOpen ? (
                <form className="rpt-reply" onSubmit={send}>
                    <textarea
                        className="form-input"
                        rows={3}
                        maxLength={4000}
                        placeholder="Add more details or answer our questions…"
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                    />
                    <button type="submit" className="btn btn-primary btn-sm" disabled={sending || !reply.trim()}>
                        {sending ? 'Sending…' : 'Send'}
                    </button>
                </form>
            ) : (
                <p className="text-muted">This report is closed. <Link to="/reports/new">File a new report</Link> if the problem continues.</p>
            )}
        </article>
    );
}

/** /reports and /reports/:id — the customer's reports & disputes. */
export default function ReportsPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [reports, setReports] = useState(null);

    const load = useCallback(async () => {
        try {
            const res = await reportsApi.mine();
            setReports(res.data.data);
        } catch {
            setReports([]);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    return (
        <div className="rpt-page page-enter">
            <div className="container">
                <div className="rpt-head">
                    <div>
                        <h1>Reports &amp; disputes</h1>
                        <p className="rpt-lead">Problems you&apos;ve reported to PickAndSync, and our replies.</p>
                    </div>
                    <Link to="/reports/new" className="btn btn-primary">Report a problem</Link>
                </div>

                {reports === null ? <p className="text-muted">Loading…</p> : reports.length === 0 ? (
                    <div className="rpt-empty">
                        <h2>No reports yet</h2>
                        <p>If something goes wrong with a trip, booking, host or traveller, tell us and we&apos;ll help.</p>
                    </div>
                ) : (
                    <div className={`rpt-layout ${id ? 'has-detail' : ''}`}>
                        <ul className="rpt-list">
                            {reports.map((r) => (
                                <li key={r.id}>
                                    <button
                                        type="button"
                                        className={`rpt-list-item ${r.id === id ? 'is-active' : ''}`}
                                        onClick={() => navigate(`/reports/${r.id}`)}
                                    >
                                        <span className={`rpt-status rpt-status-${r.status.toLowerCase()}`}>{REPORT_STATUS_LABELS[r.status]}</span>
                                        <strong>{r.subject}</strong>
                                        <small>{REPORT_CATEGORY_LABELS[r.category]} · updated {format(new Date(r.updatedAt), 'd MMM')}</small>
                                        {r.messages?.[0]?.fromAdmin && OPEN.includes(r.status) && <em>New reply from support</em>}
                                    </button>
                                </li>
                            ))}
                        </ul>
                        {id ? <ReportDetail key={id} id={id} onChanged={load} /> : (
                            <div className="rpt-detail rpt-detail-empty"><p className="text-muted">Select a report to see the conversation.</p></div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
