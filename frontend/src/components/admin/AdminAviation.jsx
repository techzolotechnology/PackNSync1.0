import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { aviationApi } from '../../api/index.js';

const documents = { registration: 'Aircraft registration', operatorPermit: 'Operator permit', airworthiness: 'Airworthiness document', insurance: 'Insurance' };
export default function AdminAviation() {
    const [records, setRecords] = useState([]);
    const [notes, setNotes] = useState({});
    const [checked, setChecked] = useState({});
    const [busy, setBusy] = useState(null);
    const [error, setError] = useState('');
    const load = useCallback(async () => {
        try { setRecords((await aviationApi.reviews()).data.data); setError(''); }
        catch (err) { setError(err.response?.data?.message || 'Could not load aircraft reviews.'); }
    }, []);
    useEffect(() => { load(); }, [load]);
    const read = async (record, kind) => {
        const tab = window.open('', '_blank');
        try {
            const result = await aviationApi.document(record.vehicleId, kind);
            const url = URL.createObjectURL(result.data);
            if (tab) tab.location.href = url; else window.location.assign(url);
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch { tab?.close(); toast.error('Document could not be opened. Check private file storage.'); }
    };
    const review = async (record, status) => {
        if (status === 'APPROVED' && !checked[record.id]) return toast.error('Confirm document and operator checks before approving.');
        if ((notes[record.id] || '').trim().length < 10) return toast.error('Record at least 10 characters of review findings.');
        setBusy(record.id);
        try { await aviationApi.review(record.vehicleId, { status, note: notes[record.id] }); await load(); toast.success('Review saved. The host must publish separately.'); }
        catch (err) { toast.error(err.response?.data?.message || 'Review failed.'); }
        finally { setBusy(null); }
    };
    return <div>
        <p>Review aircraft registration, operator authority, airworthiness and insurance evidence. Platform approval is an internal listing decision, not a DGCA approval or flight clearance.</p>
        {error && <p role="alert">{error}</p>}<button type="button" className="btn btn-ghost" onClick={load}>Refresh aircraft reviews</button>
        {!records.length && !error && <p>No aircraft submitted yet.</p>}
        {records.map((record) => <section key={record.id} className="card" style={{ padding: 20, marginTop: 18 }}>
            <h3>{record.vehicle.make} {record.vehicle.model} · {record.vehicle.licensePlate}</h3>
            <p>{record.operatorName} · {record.baseAirport} · <strong>{record.status}</strong></p>
            <p>Host: {record.vehicle.owner?.name} ({record.vehicle.owner?.email})</p>
            <p>Operator permit reference: {record.operatorPermitNumber}</p>
            <ul>{Object.entries(documents).map(([key, label]) => <li key={key}>{label}: {record.documents?.[key] ? <><button type="button" className="adm-link-btn" onClick={() => read(record, key)}>Open privately</button> {record.documents[key].expiresAt && `Expires ${new Date(record.documents[key].expiresAt).toLocaleDateString()}`}</> : 'Missing'}</li>)}</ul>
            {record.reviewNote && <p>Previous findings: {record.reviewNote}</p>}
            <label>Review findings<textarea className="form-input" value={notes[record.id] || ''} maxLength={2000} onChange={(event) => setNotes({ ...notes, [record.id]: event.target.value })} /></label>
            <label style={{ display: 'block', margin: '14px 0' }}><input type="checkbox" checked={!!checked[record.id]} onChange={(event) => setChecked({ ...checked, [record.id]: event.target.checked })} /> I checked the operator and aircraft evidence, validity dates and applicable operating authority.</label>
            <div className="admin-actions"><button type="button" className="btn btn-primary" disabled={busy === record.id || record.status !== 'PENDING' || !checked[record.id]} onClick={() => review(record, 'APPROVED')}>Approve listing review</button><button type="button" className="btn btn-danger" disabled={busy === record.id} onClick={() => review(record, 'REJECTED')}>Reject / revoke</button></div>
        </section>)}
    </div>;
}
