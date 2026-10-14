import { useEffect, useState } from 'react';
import api from '../../api/index.js';
import { InspectionDialog, InspectionEvidence } from '../DamageInspectionModal.jsx';

const statuses = ['AWAITING_REVIEW', 'DISPUTED', 'PASSED', 'DAMAGE_CONFIRMED', 'INCONCLUSIVE'];
const errorMessage = failure => failure.response?.data?.message || failure.message || 'Unable to load inspections.';
const name = value => typeof value === 'string' ? value : value?.name || [value?.make, value?.model].filter(Boolean).join(' ') || value?.id || 'Not available';

export default function AdminInspections() {
  const [status, setStatus] = useState('AWAITING_REVIEW'), [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState(null);
  const [vehicleId, setVehicleId] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setRows([]);
    api.get('/admin/inspections', { params: { ...(status ? { status } : {}), ...(vehicleId ? { vehicleId } : {}) } }).then(response => { if (active) setRows(response.data.data || []); }).catch(failure => { if (active) setError(errorMessage(failure)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [status, vehicleId, revision]);
  return <section className="inspection-admin"><div className="inspection-toolbar"><div><h2>Vehicle inspections</h2><p>Compare original evidence, acknowledgements and condition notes before recording a decision.</p></div><button type="button" disabled={loading} onClick={() => setRevision(n => n + 1)}>Refresh queue</button></div>
    <label>Review status<select value={status} onChange={event => setStatus(event.target.value)}><option value="">All statuses</option>{statuses.map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label>
    {vehicleId && <div className="inspection-toolbar"><p>Vehicle history · {vehicleId}<br /><small>Up to 100 most recent inspections, filtered by the selected status.</small></p><button type="button" onClick={() => setVehicleId('')}>Clear vehicle filter</button></div>}
    {loading && <p role="status">Loading review queue…</p>}{error && <p className="inspection-error" role="alert">{error} Complete admin MFA if prompted, then refresh.</p>}
    {!loading && !error && (rows.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Booking / vehicle</th><th>Renter</th><th>Host</th><th>Created</th><th>Status</th><th>Action</th></tr></thead><tbody>{rows.map(row => <tr key={row.bookingId}><td>{name(row.vehicle)}<br /><small>{row.bookingId}</small></td><td>{name(row.renter)}</td><td>{name(row.host)}</td><td>{row.createdAt ? new Date(row.createdAt).toLocaleString() : 'Not recorded'}</td><td>{row.reviewStatus?.replaceAll('_', ' ')}</td><td><button type="button" onClick={() => setSelected(row)}>Review evidence</button> <button type="button" disabled={!row.vehicle?.id} onClick={() => { setVehicleId(row.vehicle.id); setStatus(''); setRevision(n => n + 1); }}>Vehicle history</button></td></tr>)}</tbody></table></div> : <p>No inspections match this filter.</p>)}
    {selected && <AdminInspectionReview key={selected.bookingId} booking={selected} onClose={() => setSelected(null)} onSaved={() => setRevision(n => n + 1)} />}
  </section>;
}

function AdminInspectionReview({ booking, onClose, onSaved }) {
  const [report, setReport] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [busy, setBusy] = useState(false), [revision, setRevision] = useState(0), [saved, setSaved] = useState('');
  const [decision, setDecision] = useState('INCONCLUSIVE'), [reason, setReason] = useState('');
  const [includeQuote, setIncludeQuote] = useState(false), [workshop, setWorkshop] = useState(''), [total, setTotal] = useState(''), [reference, setReference] = useState('');
  const base = `/admin/inspections/${encodeURIComponent(booking.bookingId)}`;
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    api.get(base).then(response => {
      if (!active) return;
      const data = response.data.data; setReport(data); setDecision(['PASSED', 'DAMAGE_CONFIRMED', 'INCONCLUSIVE'].includes(data.review?.status) ? data.review.status : 'INCONCLUSIVE'); setReason(data.review?.reason || '');
      const quote = data.review?.quote; setIncludeQuote(Boolean(quote)); setWorkshop(quote?.workshop || ''); setTotal(quote?.total != null ? String(quote.total) : ''); setReference(quote?.reference || '');
    }).catch(failure => { if (active) setError(errorMessage(failure)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [base, revision]);
  const bothConfirmed = report && ['checkin', 'checkout'].every(stage => [report.renter?.id, report.host?.id].every(id => id && report.confirmations?.[stage]?.[id]));
  const reasonValid = reason.trim().length >= 10 && reason.trim().length <= 2000;
  const decisionValid = Number.isInteger(report?.version) && report?.hasCheckout && (decision !== 'PASSED' || bothConfirmed);
  const quoteValid = !includeQuote || workshop.trim() && reference.trim() && total.trim() !== '' && Number.isFinite(Number(total)) && Number(total) > 0 && Number(total) <= 10000000 && Math.abs(Math.round(Number(total) * 100) - Number(total) * 100) < 0.000001;
  async function save(event) {
    event.preventDefault(); if (busy || !reasonValid || !quoteValid || !decisionValid) return;
    setBusy(true); setError(''); setSaved('');
    try {
      await api.post(`${base}/review`, { decision, expectedVersion: report.version, reason: reason.trim(), ...(includeQuote ? { quote: { workshop: workshop.trim(), currency: 'INR', total: Number(total), reference: reference.trim() } } : {}) });
      setSaved('Review decision saved. No wallet was charged.'); setRevision(n => n + 1); onSaved();
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  return <InspectionDialog title={`Review · ${name(booking.vehicle)}`} onClose={onClose} busy={busy}>
    <div className="inspection-toolbar"><p>Booking {booking.bookingId}<br />Renter: {name(booking.renter)} · Host: {name(booking.host)}</p><button type="button" disabled={busy || loading} onClick={() => setRevision(n => n + 1)}>Refresh evidence</button></div>
    {loading && <p role="status">Loading private evidence…</p>}{error && <p role="alert" className="inspection-error">{error}</p>}{saved && <p role="status" className="inspection-banner">{saved}</p>}
    {!loading && report && <><InspectionEvidence report={report} /><form className="inspection-actions" onSubmit={save}><h3>Record a human review decision</h3><p>Use inconclusive when views or lighting prevent a reliable comparison. A workshop quote is a recorded document amount; this action does not charge a wallet or settle liability.</p><p>Passing requires host and renter acknowledgements for pickup and return. Return evidence is required for every decision.</p><fieldset disabled={busy}><label>Decision<select value={decision} onChange={event => { setDecision(event.target.value); if (event.target.value !== 'DAMAGE_CONFIRMED') setIncludeQuote(false); }}><option value="PASSED" disabled={!bothConfirmed}>Passed — no damage confirmed</option><option value="DAMAGE_CONFIRMED">Damage confirmed by reviewer</option><option value="INCONCLUSIVE">Inconclusive — evidence insufficient</option></select></label><label>Review reason (10–2000 characters)<textarea required minLength={10} maxLength={2000} value={reason} onChange={event => setReason(event.target.value)} placeholder="Explain the evidence supporting your decision." /></label>
      <label className="inspection-checkbox"><input type="checkbox" disabled={decision !== "DAMAGE_CONFIRMED"} checked={includeQuote} onChange={event => setIncludeQuote(event.target.checked)} />Attach workshop quote details (optional, confirmed damage only)</label>{includeQuote && <div className="inspection-pair"><label>Workshop<input required maxLength={160} value={workshop} onChange={event => setWorkshop(event.target.value)} /></label><label>Total (INR)<input required type="number" min="0.01" max="10000000" step="0.01" value={total} onChange={event => setTotal(event.target.value)} /></label><label>Quote reference<input required maxLength={200} value={reference} onChange={event => setReference(event.target.value)} /></label></div>}
      <button type="submit" className="inspection-primary" disabled={busy || !reasonValid || !quoteValid || !decisionValid}>{busy ? 'Saving decision…' : 'Save review decision'}</button></fieldset></form></>}
  </InspectionDialog>;
}
