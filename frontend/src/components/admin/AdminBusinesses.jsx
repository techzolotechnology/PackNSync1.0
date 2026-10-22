import { useEffect, useState } from 'react';
import api from '../../api/index.js';
import '../RentalBusinessProfile.css';
export default function AdminBusinesses() {
    const [rows, setRows] = useState([]); const [notes, setNotes] = useState({});
    const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
    const load = async () => { try { const { data } = await api.get('/admin/businesses'); setRows(data.data); } catch(e) { setMessage(e.response?.data?.message || 'Unable to load businesses.'); } };
    useEffect(() => { load(); }, []);
    const review = async (row, status) => {
        setBusy(true); setMessage('');
        try { await api.patch(`/admin/businesses/${row.userId}/review`, { status, expectedVersion: row.version, reviewNotes: notes[row.userId] || '' }); await load(); setMessage('Review saved.'); }
        catch(e) { setMessage(e.response?.data?.message || 'Unable to save review.'); }
        finally { setBusy(false); }
    };
    return <section><h2>Rental businesses</h2><p>Check the business identity and registration through your review process before approving. Existing vehicle checks still apply.</p><button onClick={load}>Refresh</button><p role="status">{message}</p>
        {!rows.length && <p>No rental businesses to display.</p>}
        {rows.map(row => <article className="rental-business card" key={row.userId}>
            <h3>{row.businessName} · {row.status}</h3><p>Account: {row.user.name}</p><p>{row.address}</p><p>Contact: {row.contactNumber}</p><p>Registration reference: {row.registrationReference}</p><p>GST: {row.gstNumber || 'Not provided'}</p>
            {row.reviewNotes && <p>Previous review: {row.reviewNotes}</p>}
            <label>Verification checks / reason<textarea maxLength={1000} value={notes[row.userId] || ''} onChange={e => setNotes({ ...notes, [row.userId]: e.target.value })} /></label>
            <button disabled={busy || !notes[row.userId]?.trim()} onClick={() => review(row, 'APPROVED')}>Approve business</button> <button disabled={busy || !notes[row.userId]?.trim()} onClick={() => review(row, 'REJECTED')}>Reject business</button>
        </article>)}
    </section>;
}
