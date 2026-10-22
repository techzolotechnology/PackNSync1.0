import { useCallback, useEffect, useRef, useState } from 'react';
import { aviationApi } from '../api/index.js';
import { useAuthStore } from '../store/authStore.js';
import { useAuthUiStore } from '../store/authUiStore.js';
import './HelicopterChartersPage.css';

const amount = (value, currency = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(value);
export default function HelicopterChartersPage() {
    const user = useAuthStore((s) => s.user);
    const openAuth = useAuthUiStore((s) => s.openAuth);
    const [aircraft, setAircraft] = useState([]);
    const [mine, setMine] = useState([]);
    const [mineOwner, setMineOwner] = useState(null);
    const loadId = useRef(0);
    const [selected, setSelected] = useState(null);
    const [form, setForm] = useState({ requestedDate: '', origin: '', destination: '', passengers: '1', notes: '' });
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const load = useCallback(async () => {
        const generation = ++loadId.current;
        setError(''); setLoading(true);
        const results = await Promise.allSettled([aviationApi.aircraft(), user ? aviationApi.mine() : Promise.resolve({ data: { data: [] } })]);
        if (generation !== loadId.current) return;
        if (results[0].status === 'fulfilled') setAircraft(results[0].value.data.data); else setError('Could not load helicopter charters. Please try again.');
        if (results[1].status === 'fulfilled') { setMine(results[1].value.data.data); setMineOwner(user?.id || null); } else setError('Your charter enquiries could not load. Please try again.');
        setLoading(false);
    }, [user]);
    useEffect(() => { setSelected(null); load(); return () => { loadId.current += 1; }; }, [load]);
    const request = async (event) => {
        event.preventDefault();
        if (!user) return openAuth('login');
        setBusy(true); setError(''); setMessage('');
        try { await aviationApi.enquire(selected.id, { ...form, passengers: Number(form.passengers) }); setSelected(null); await load(); setMessage('Enquiry sent. You will receive an operator quote here. No flight is booked or paid yet.'); }
        catch (err) { setError(err.response?.data?.message || 'Could not send the enquiry.'); }
        finally { setBusy(false); }
    };
    const cancel = async (id) => {
        setBusy(true); setError('');
        try { await aviationApi.cancel(id); await load(); }
        catch (err) { setError(err.response?.data?.message || 'Could not cancel this enquiry.'); }
        finally { setBusy(false); }
    };
    const field = (key) => ({ value: form[key], onChange: (event) => setForm({ ...form, [key]: event.target.value }) });
    return <div className="charter-page container">
        <header className="charter-hero"><span className="charter-eyebrow">PICKANDSYNC · OPERATOR-LED CHARTERS</span><h1>Helicopter charters, with the details in one place.</h1><p>Explore listed aircraft and ask the operator for a quote tailored to your route, date and passengers.</p></header>
        <p className="charter-notice">Hourly prices are indicative. Sending an enquiry or receiving a quote does not confirm a flight or take payment. The operator must arrange availability, permissions and flight confirmation. A platform listing review is not regulatory approval.</p>
        {error && <p className="charter-error" role="alert">{error}</p>}{message && <p className="charter-notice" role="status">{message}</p>}
        <button className="btn btn-ghost" type="button" onClick={load} disabled={loading}>Refresh listings & enquiries</button>
        {loading ? <p>Loading charter listings…</p> : !aircraft.length && !error ? <p>No reviewed helicopter listings are published yet.</p> : null}
        <div className="charter-grid">{aircraft.map((a) => <article key={a.id} className="charter-card">
            {/^https?:\/\//.test(a.vehicle.images?.[0] || '') ? <img src={a.vehicle.images[0]} alt={`${a.vehicle.make} ${a.vehicle.model}`} /> : <div className="charter-photo" aria-hidden="true">🚁</div>}
            <div className="charter-card-body"><h2>{a.vehicle.make} {a.vehicle.model}</h2><p>{a.operatorName} · {a.baseAirport}</p><p>{a.vehicle.seats} passenger seats</p><strong>{amount(a.pricePerHour, a.currency)} / hour indicative</strong>{a.description && <p>{a.description}</p>}<button type="button" className="btn btn-primary" onClick={() => { if (!user) return openAuth('login'); setSelected(a); setError(''); }}>Request an operator quote</button></div>
        </article>)}</div>
        {selected && <form className="charter-form" onSubmit={request}><h2>Request a quote · {selected.vehicle.make} {selected.vehicle.model}</h2>
            <label>Travel date<input className="form-input" type="date" required min={new Date().toISOString().slice(0, 10)} {...field('requestedDate')} /></label>
            <label>Origin / departure helipad<input className="form-input" required maxLength={200} {...field('origin')} /></label><label>Destination<input className="form-input" required maxLength={200} {...field('destination')} /></label>
            <label>Passengers<input className="form-input" type="number" required min="1" max={selected.vehicle.seats} {...field('passengers')} /></label><label>Preferred time and other details<textarea className="form-input" maxLength={2000} {...field('notes')} /></label>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Send charter enquiry'}</button><button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setSelected(null)}>Close form</button>
        </form>}
        {user && mineOwner === user.id && <section><h2>Your charter enquiries</h2>{!mine.length && <p>No enquiries yet.</p>}{mine.map((inquiry) => <article key={inquiry.id} className="charter-form"><h3>{inquiry.origin} → {inquiry.destination}</h3><p>{new Date(inquiry.requestedDate).toLocaleDateString()} · {inquiry.passengers} passengers · {inquiry.status}</p>{inquiry.quotedAmount ? <strong>Operator quote: {amount(inquiry.quotedAmount, inquiry.aircraft.currency)}</strong> : null}{inquiry.quoteNote && <p>{inquiry.quoteNote}</p>}{['NEW', 'QUOTED'].includes(inquiry.status) && <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => cancel(inquiry.id)}>Cancel enquiry</button>}</article>)}</section>}
    </div>;
}
