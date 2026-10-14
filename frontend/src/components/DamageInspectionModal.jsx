import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api, { rentalsApi } from '../api/index.js';
import './DamageInspectionModal.css';

const ANGLES = ['front', 'rear', 'left', 'right', 'windshield', 'interior'];
const GUIDES = ['Include bumper, bonnet and both headlights.', 'Include boot, bumper and both tail lights.', 'Show the full left side, doors and wheels.', 'Show the full right side, doors and wheels.', 'Photograph the entire glass without reflections.', 'Show seats, dashboard and cabin condition.'];
const emptyPhotos = () => ANGLES.map(angle => ({ angle, url: '', condition: 'not_reported', findings: [] }));
const message = failure => failure.response?.data?.message || failure.message || 'Request failed. Please retry.';
const readable = value => value === 'not_reported' ? 'Scratch notes skipped (optional)' : String(value || 'Not recorded').replaceAll('_', ' ');

export function InspectionDialog({ title, onClose, busy, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus?.(); };
  }, []);
  function keyboard(event) {
    if (event.key === 'Escape' && !busy) { event.stopPropagation(); onClose(); }
    if (event.key !== 'Tab') return;
    const nodes = [...ref.current.querySelectorAll('button, input, select, textarea, a[href], [tabindex="0"]')].filter(node => !node.disabled && node.getClientRects().length);
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { event.preventDefault(); first.focus(); }
  }
  return <div className="inspection-modal-overlay"><section ref={ref} tabIndex={-1} onKeyDown={keyboard} className="inspection-modal-card" role="dialog" aria-modal="true" aria-label={title}>
    <header className="inspection-modal-header"><div><small>VEHICLE CONDITION · EVIDENCE FIRST</small><h2>{title}</h2></div><button type="button" aria-label="Close inspection" disabled={busy} onClick={onClose}>✕</button></header>
    <div className="inspection-modal-body">{children}</div>
  </section></div>;
}

function EvidencePhoto({ item, regions }) {
  const [source, setSource] = useState('');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true, objectUrl;
    const controller = new AbortController();
    setSource(''); setError('');
    if (item?.url) {
      const path = item.url.replace(/^\/api(?=\/)/, '');
      if (!/^\/(rentals\/bookings|admin\/inspections)\//.test(path) || path.includes('?')) { setError('Invalid evidence path.'); return; }
      api.get(path, { responseType: 'blob', signal: controller.signal }).then(response => {
        if (active) { objectUrl = URL.createObjectURL(response.data); setSource(objectUrl); }
      }).catch(failure => { if (active) setError(message(failure)); });
    }
    return () => { active = false; controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [item?.url, retry]);
  if (!item) return <div className="inspection-placeholder">No photo recorded</div>;
  return <><div className="inspection-photo">{source ? <img src={source} alt={`${item.angle} condition evidence`} /> : <p role={error ? 'alert' : 'status'}>{error || 'Loading private photo…'}{error && <button type="button" onClick={() => setRetry(n => n + 1)}>Retry photo</button>}</p>}
    {source && regions?.length > 0 && <svg viewBox="0 0 1 1" preserveAspectRatio="none" aria-label="Visual change regions">{regions.filter(r => [r.x, r.y, r.width, r.height].every(Number.isFinite)).map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.width} height={r.height} />)}</svg>}
  </div><p>{readable(item.condition)}</p>{item.damages?.map((note, i) => <p key={note.id || i}>{readable(note.type)} · {note.severity}: {note.note}</p>)}
    <details><summary>Evidence metadata</summary><p>Quality: {typeof item.quality === 'object' ? JSON.stringify(item.quality) : readable(item.quality)}</p><code>SHA-256: {item.sha256 || 'Not available'}</code></details></>;
}

export function InspectionEvidence({ report }) {
  const [showRegions, setShowRegions] = useState(false);
  return <section className="inspection-evidence"><h3>Evidence & human review</h3><div className="inspection-banner">Photos and condition notes support human review. Visual changes may come from lighting or position; they are not detected scratches or a liability decision. This workflow does not charge a wallet or promise insurance coverage.</div>
    <p><strong>Review: {readable(report.review?.status || 'AWAITING_REVIEW')}</strong> · {report.review?.reason || 'No reviewer reason recorded.'}</p>
    {report.review?.quote && <p>Workshop quote: {report.review.quote.workshop} · {report.review.quote.currency} {report.review.quote.total} · Reference {report.review.quote.reference}</p>}
    {report.summary && <details><summary>Report summary</summary><pre>{typeof report.summary === 'string' ? report.summary : JSON.stringify(report.summary, null, 2)}</pre></details>}
    <div className="inspection-pair">{['checkin', 'checkout'].map(stage => <section key={stage}><h4>{stage === 'checkin' ? 'Pickup' : 'Return'} acknowledgements</h4><p>Odometer: {report[stage]?.odometer ?? 'Not recorded'} · Fuel: {report[stage]?.fuelPercent != null ? `${report[stage].fuelPercent}%` : 'Not recorded'}</p>
      {Object.entries(report.confirmations?.[stage] || {}).length ? Object.entries(report.confirmations[stage]).map(([id, confirmation]) => <p key={id}><strong>{id === report.host?.id ? `Host · ${report.host.name || id}` : id === report.renter?.id ? `Renter · ${report.renter.name || id}` : id}</strong> · {confirmation.at ? new Date(confirmation.at).toLocaleString() : 'Date unavailable'}<br />{confirmation.comment || 'No comment'}</p>) : <p>No party acknowledgements yet.</p>}</section>)}</div>
    <label className="inspection-checkbox"><input type="checkbox" checked={showRegions} onChange={event => setShowRegions(event.target.checked)} />Show visual change regions (review aid)</label>
    {ANGLES.map(angle => { const comparison = report.comparison?.find(row => row.angle === angle); return <article key={angle} className="inspection-evidence-angle"><h4>{angle}</h4><p>{comparison ? `${readable(comparison.status)}${Number.isFinite(comparison.changedFraction) ? ` · ${(comparison.changedFraction * 100).toFixed(1)}% visual change` : ''}` : 'Comparison not available'}</p><div className="inspection-pair">{['checkin', 'checkout'].map(stage => <div key={stage}><h5>{stage === 'checkin' ? 'Pickup' : 'Return'}</h5><EvidencePhoto item={report[stage]?.images?.find(item => item.angle === angle)} regions={showRegions && stage === 'checkout' ? comparison?.regions : []} /></div>)}</div></article>; })}
  </section>;
}

async function capture(file) {
  if (!file || !['image/jpeg', 'image/png'].includes(file.type) || file.size > 12 * 1024 * 1024) throw new Error('Choose a JPEG or PNG under 12 MB.');
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width < 320 || bitmap.height < 240) throw new Error('Use a photo at least 320 × 240 pixels.');
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    if (canvas.width < 320 || canvas.height < 240) throw new Error('Retake this view with a less panoramic frame.');
    let result = canvas.toDataURL('image/jpeg', 0.72);
    for (const quality of [0.6, 0.48, 0.36]) { if (result.length <= 1400000) break; result = canvas.toDataURL('image/jpeg', quality); }
    if (result.length > 1400000) throw new Error('Photo is still too large. Retake a simpler, clear view.');
    return result;
  } finally { bitmap.close(); }
}

export default function DamageInspectionModal(props) {
  return props.isOpen && props.booking?.id ? <InspectionSession key={props.booking.id} {...props} /> : null;
}
function InspectionSession({ booking, onClose, onRefresh }) {
  const [report, setReport] = useState(null), [photos, setPhotos] = useState(emptyPhotos);
  const [step, setStep] = useState(0), [consent, setConsent] = useState(false);
  const [odometer, setOdometer] = useState(''), [fuel, setFuel] = useState('');
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [revision, setRevision] = useState(0), [comment, setComment] = useState(''), [reason, setReason] = useState(''), [confirmStage, setConfirmStage] = useState('checkin');
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    rentalsApi.getInspection(booking.id).then(response => { if (active) setReport(response.data.data); }).catch(failure => { if (active) setError(message(failure)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [booking.id, revision]);
  const base = `/rentals/bookings/${encodeURIComponent(booking.id)}/inspection`;
  function change(values) { setPhotos(current => current.map((photo, index) => index === step ? { ...photo, ...values } : photo)); }
  async function action(task, success) {
    setBusy(true); setError('');
    try { await task(); if (alive.current) { toast.success(success); setRevision(n => n + 1); onRefresh?.(); } }
    catch (failure) { if (alive.current) setError(message(failure)); }
    finally { if (alive.current) setBusy(false); }
  }
  const numericValid = (odometer === '' || /^\d+$/.test(odometer) && Number.isSafeInteger(Number(odometer)) && Number(odometer) <= 9999999 && (!report?.hasCheckin || report.checkin?.odometer == null || Number(odometer) >= report.checkin.odometer)) && (fuel === '' || Number.isInteger(Number(fuel)) && Number(fuel) >= 0 && Number(fuel) <= 100);
  const photo = photos[step];
  const complete = photos.filter(item => item.url).length;
  const canSave = consent && complete === 6 && numericValid && photos.every(item => item.findings.every(note => note.note.trim()));
  async function submit() {
    if (new Set(photos.map(item => item.url)).size !== 6) { setError('Use a separate photo for each vehicle view.'); return; }
    await action(async () => {
      const payload = { images: photos.map(item => ({ ...item, findings: item.findings.map(note => ({ ...note, note: note.note.trim() })) })), consent: true, ...(odometer !== '' ? { odometer: Number(odometer) } : {}), ...(fuel !== '' ? { fuelPercent: Number(fuel) } : {}) };
      await (report?.hasCheckin ? rentalsApi.checkoutInspection : rentalsApi.checkinInspection)(booking.id, payload);
      setPhotos(emptyPhotos()); setConsent(false); setStep(0); setOdometer(''); setFuel('');
    }, 'Evidence saved for human review.');
  }
  return <InspectionDialog title="Vehicle condition report" onClose={onClose} busy={busy}>
    <div className="inspection-toolbar"><p>Match the six views at pickup and return. Use daylight, keep the vehicle in frame and avoid people or personal documents.</p><button type="button" disabled={busy || loading} onClick={() => setRevision(n => n + 1)}>Refresh</button></div>
    {loading && <p role="status">Loading inspection…</p>}{error && <p className="inspection-error" role="alert">{error}</p>}
    {!loading && report && <>
      {!report.hasCheckout && <section className="inspection-capture"><h3>{report.hasCheckin ? 'Return' : 'Pickup'} · Guided capture</h3><p>{complete} of 6 photos ready. Review each photo before saving. Scratch notes are optional; we recommend adding any visible marks, especially before pickup.</p><progress value={complete} max={6} aria-label="Capture progress" />
        <nav className="inspection-steps" aria-label="Capture views">{ANGLES.map((angle, index) => <button type="button" key={angle} disabled={busy} aria-current={step === index ? 'step' : undefined} onClick={() => setStep(index)}>{index + 1}. {angle} {photos[index].url ? '✓' : ''}</button>)}</nav>
        <fieldset disabled={busy}><legend>{step + 1}. {photo.angle}</legend><p>{GUIDES[step]}</p><div className="inspection-capture-grid"><div>{photo.url ? <img className="inspection-preview" src={photo.url} alt={`${photo.angle} preview`} /> : <div className="inspection-placeholder">Capture a clear {photo.angle} view</div>}<label>{photo.url ? 'Replace photo' : 'Take or upload photo'}<input type="file" accept="image/jpeg,image/png" capture="environment" onChange={async event => {
          const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
          setBusy(true); setError(''); try { change({ url: await capture(file) }); } catch (failure) { setError(message(failure)); } finally { setBusy(false); }
        }} /></label></div><div><p className="inspection-muted">Scratch notes are optional. If you notice scratches or other damage, we recommend recording them before pickup. Notes are attached to this photo; describe the exact location.</p><label>Scratch / condition notes (optional)<select value={photo.condition} onChange={event => change({ condition: event.target.value, findings: event.target.value === 'damage_reported' ? (photo.findings.length ? photo.findings : [{ type: 'scratch', severity: 'minor', note: '' }]) : [] })}><option value="not_reported">Skip notes for this photo</option><option value="no_visible_damage">I checked: no visible damage observed</option><option value="damage_reported">Condition notes / damage observed</option></select></label>
          {photo.findings.map((note, index) => { const update = values => change({ findings: photo.findings.map((item, i) => i === index ? { ...item, ...values } : item) }); return <div className="inspection-note" key={index}><label>Type<select value={note.type} onChange={event => update({ type: event.target.value })}>{['scratch', 'dent', 'crack', 'chip', 'broken', 'missing'].map(type => <option key={type}>{type}</option>)}</select></label><label>Severity<select value={note.severity} onChange={event => update({ severity: event.target.value })}>{['minor', 'moderate', 'severe'].map(value => <option key={value}>{value}</option>)}</select></label><label>Location & observation<textarea maxLength={500} value={note.note} onChange={event => update({ note: event.target.value })} placeholder="Describe what you can see and where." /></label><button type="button" onClick={() => change({ findings: photo.findings.filter((_, i) => i !== index), ...(photo.findings.length === 1 ? { condition: 'not_reported' } : {}) })}>Remove note {index + 1}</button></div>; })}
          <button type="button" disabled={photo.findings.length >= 10} onClick={() => change({ condition: 'damage_reported', findings: [...photo.findings, { type: 'scratch', severity: 'minor', note: '' }] })}>+ Add scratch or damage note (optional)</button></div></div></fieldset>
        <div className="inspection-toolbar"><button type="button" disabled={busy || step === 0} onClick={() => setStep(n => n - 1)}>Previous view</button><button type="button" disabled={busy || step === 5} onClick={() => setStep(n => n + 1)}>Next view →</button></div>
        <div className="inspection-pair"><label>Odometer (km, optional)<input type="number" min="0" max="9999999" step="1" disabled={busy} value={odometer} onChange={event => setOdometer(event.target.value)} /></label><label>Fuel (0–100%, optional)<input type="number" min="0" max="100" step="1" disabled={busy} value={fuel} onChange={event => setFuel(event.target.value)} /></label></div>{!numericValid && <p role="alert">Use a whole odometer reading up to 9,999,999 (at least the pickup reading) and whole fuel percentage between 0 and 100.</p>}
        <label className="inspection-checkbox"><input type="checkbox" checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} />I consent to storing these photos and observations for this booking and confirm they reflect the vehicle condition.</label>
        <p className="inspection-muted">All six photos, consent and a description for every note are required.</p><button type="button" className="inspection-primary" disabled={busy || !canSave} onClick={submit}>{busy ? 'Saving…' : `Save ${report.hasCheckin ? 'return' : 'pickup'} evidence`}</button>
      </section>}
      {report.hasCheckin && <><InspectionEvidence report={report} /><section className="inspection-actions"><h3>Acknowledge or dispute evidence</h3><p>Acknowledgement records your review of a stage. Both parties’ acknowledgements appear above.</p><label>Stage<select disabled={busy} value={confirmStage} onChange={event => setConfirmStage(event.target.value)}><option value="checkin">Pickup</option>{report.hasCheckout && <option value="checkout">Return</option>}</select></label><label>Comment (optional)<textarea disabled={busy} maxLength={1000} value={comment} onChange={event => setComment(event.target.value)} /></label><button type="button" disabled={busy} onClick={() => action(() => api.post(`${base}/confirm`, { stage: confirmStage, comment: comment.trim() }), 'Acknowledgement recorded.')}>Acknowledge selected stage</button><label>Dispute reason (10–2000 characters)<textarea disabled={busy} minLength={10} maxLength={2000} value={reason} onChange={event => setReason(event.target.value)} /></label><button type="button" disabled={busy || reason.trim().length < 10 || reason.trim().length > 2000} onClick={() => action(() => api.post(`${base}/dispute`, { reason: reason.trim() }), 'Dispute submitted for review.')}>Submit dispute</button><button type="button" disabled={busy} onClick={() => action(async () => {
        const response = await api.get(`${base}/export`); const url = URL.createObjectURL(new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' }));
        const link = document.createElement('a'); link.href = url; link.download = `inspection-${booking.id}.json`; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, 'Evidence bundle downloaded.')}>Download JSON evidence</button></section></>}
    </>}
  </InspectionDialog>;
}
