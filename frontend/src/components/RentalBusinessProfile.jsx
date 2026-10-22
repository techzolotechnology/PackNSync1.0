import { useEffect, useState } from 'react';
import api from '../api/index.js';
import './RentalBusinessProfile.css';
const blank = { hostType: 'INDIVIDUAL', businessName: '', address: '', contactNumber: '', gstNumber: '', registrationReference: '' };
export default function RentalBusinessProfile() {
    const [form, setForm] = useState(blank);
    const [ready, setReady] = useState(false);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const load = () => { setReady(false); api.get('/users/me/business').then(({ data }) => { setForm(data.data || blank); setReady(true); }).catch(e => setMessage(e.response?.data?.message || 'Unable to load business details.')); };
    useEffect(() => { load(); }, []);
    const save = async e => {
        e.preventDefault(); setBusy(true); setMessage('');
        try { const { data } = await api.put('/users/me/business', { ...form, expectedVersion: form.version }); setForm(data.data); setMessage(data.data.status === 'PENDING' ? 'Submitted for admin review. You can add vehicles while waiting; publish after approval.' : 'Host profile saved.'); }
        catch (err) { setMessage(err.response?.data?.message || 'Unable to save.'); }
        finally { setBusy(false); }
    };
    return <section className="rental-business card" aria-label="Host profile">
        <h2>How do you host?</h2>
        {!ready ? <><p role="status">{message || 'Loading your host profile…'}</p><button type="button" onClick={load}>Retry</button></> : <form onSubmit={save}>
            <label>Host type<select value={form.hostType} onChange={e => setForm({ ...form, hostType: e.target.value })}><option value="INDIVIDUAL">Individual vehicle owner</option><option value="RENTAL_SHOP">Car / bike rental shop owner</option></select></label>
            {form.hostType === 'RENTAL_SHOP' && <>
                <p>Manage your fleet in this dashboard. Business approval is separate from vehicle verification.</p>
                {[['businessName','Shop / business name',120],['address','Business address',500],['contactNumber','Business contact number',30],['registrationReference','Business registration / rental permit reference',200],['gstNumber','GST number (optional)',15]].map(([key,label,max]) => <label key={key}>{label}<input value={form[key]} maxLength={max} required={key !== 'gstNumber'} type={key === 'contactNumber' ? 'tel' : 'text'} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>)}
                <p>Review status: {form.status || 'Not submitted'}. Updated business details require another review.</p>
                {form.reviewNotes && <p>Admin feedback: {form.reviewNotes}</p>}
            </>}
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save host profile'}</button>
            <p role="status">{message}</p>
        </form>}
    </section>;
}
