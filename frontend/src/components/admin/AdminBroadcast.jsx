import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { adminApi } from '../../api/index.js';

const AUDIENCES = [
    { id: 'ALL', label: 'Everyone', hint: 'All active users' },
    { id: 'HOSTS', label: 'Hosts', hint: 'Users with a vehicle listing' },
    { id: 'ORGANIZERS', label: 'Trip organizers', hint: 'Users who posted a trip' },
    { id: 'VERIFIED', label: 'KYC verified', hint: 'Aadhaar + DL approved' },
    { id: 'CITY', label: 'By city', hint: 'Profile city or listing location' },
];

/** Send an in-app announcement to a segment of users. */
export default function AdminBroadcast() {
    const [form, setForm] = useState({ audience: 'ALL', city: '', title: '', body: '' });
    const [recipients, setRecipients] = useState(null);
    const [history, setHistory] = useState([]);
    const [sending, setSending] = useState(false);

    const loadHistory = useCallback(async () => {
        try {
            const res = await adminApi.getBroadcasts();
            setHistory(res.data.data);
        } catch { /* history is optional */ }
    }, []);

    useEffect(() => { loadHistory(); }, [loadHistory]);

    // Live recipient count for the chosen audience
    useEffect(() => {
        if (form.audience === 'CITY' && form.city.trim().length < 2) { setRecipients(null); return undefined; }
        const t = setTimeout(async () => {
            try {
                const res = await adminApi.previewBroadcast({ audience: form.audience, city: form.city });
                setRecipients(res.data.data.recipients);
            } catch {
                setRecipients(null);
            }
        }, 350);
        return () => clearTimeout(t);
    }, [form.audience, form.city]);

    const send = async (e) => {
        e.preventDefault();
        if (!recipients) return toast.error('Nobody matches this audience.');
        const who = AUDIENCES.find((a) => a.id === form.audience).label;
        if (!window.confirm(`Send “${form.title}” to ${recipients} ${recipients === 1 ? 'person' : 'people'} (${who}${form.audience === 'CITY' ? `: ${form.city}` : ''})?\n\nThis can't be undone.`)) return;
        setSending(true);
        try {
            const res = await adminApi.sendBroadcast(form);
            toast.success(`Sent to ${res.data.data.recipients} ${res.data.data.recipients === 1 ? 'person' : 'people'}.`);
            setForm({ ...form, title: '', body: '' });
            loadHistory();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Send failed.');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="adm-broadcast">
            <form className="adm-edit-form" onSubmit={send}>
                <fieldset className="adm-audience">
                    <legend>Who should get it?</legend>
                    {AUDIENCES.map((a) => (
                        <label key={a.id} className={form.audience === a.id ? 'is-selected' : ''}>
                            <input type="radio" name="audience" value={a.id} checked={form.audience === a.id} onChange={() => setForm({ ...form, audience: a.id })} />
                            <strong>{a.label}</strong>
                            <small>{a.hint}</small>
                        </label>
                    ))}
                </fieldset>
                {form.audience === 'CITY' && (
                    <label>
                        <span>City</span>
                        <input className="form-input" placeholder="e.g. Bangalore" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                    </label>
                )}
                <label>
                    <span>Title <small>({form.title.length}/80)</small></span>
                    <input className="form-input" maxLength={80} placeholder="e.g. Diwali weekend: book early" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </label>
                <label>
                    <span>Message <small>({form.body.length}/500)</small></span>
                    <textarea className="form-input" rows={4} maxLength={500} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
                </label>
                <div className="admin-actions">
                    <button type="submit" className="btn btn-primary" disabled={sending || !recipients || form.title.trim().length < 3 || form.body.trim().length < 5}>
                        {sending ? 'Sending…' : `Send to ${recipients ?? '…'} ${recipients === 1 ? 'person' : 'people'}`}
                    </button>
                    <span className="adm-inline-note">Delivered as an in-app notification (bell icon).</span>
                </div>
            </form>

            <section>
                <h3 className="adm-subhead">Sent announcements</h3>
                <div className="admin-table-wrap">
                    <table className="admin-table">
                        <thead><tr><th>Sent</th><th>Title</th><th>Audience</th><th>People</th><th>By</th></tr></thead>
                        <tbody>
                            {history.length === 0 ? <tr><td colSpan="5">Nothing sent yet.</td></tr> : history.map((b) => (
                                <tr key={b.id}>
                                    <td>{format(new Date(b.createdAt), 'd MMM yyyy, HH:mm')}</td>
                                    <td><strong>{b.title}</strong><br /><small>{b.body}</small></td>
                                    <td>{AUDIENCES.find((a) => a.id === b.audience)?.label || b.audience}{b.city ? ` · ${b.city}` : ''}</td>
                                    <td>{b.recipients}</td>
                                    <td>{b.admin?.name || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
