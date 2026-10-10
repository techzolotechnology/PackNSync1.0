import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { adminApi } from '../../api/index.js';
import { formatMoney } from '../../config/markets.js';

const KINDS = [
    { id: 'DISCOUNT', label: 'Rental discount', hint: 'Taken off when they pay for a car or bike' },
    { id: 'CREDIT', label: 'Wallet credit', hint: 'Added to their wallet now; rentals only' },
];

const AUDIENCES = [
    { id: 'ALL', label: 'Everyone', hint: 'All active users' },
    { id: 'SELECTED', label: 'Selected people', hint: 'Pick people by name or email' },
    { id: 'HOSTS', label: 'Hosts', hint: 'Users with a vehicle listing' },
    { id: 'ORGANIZERS', label: 'Trip organizers', hint: 'Users who posted a trip' },
    { id: 'VERIFIED', label: 'KYC verified', hint: 'Aadhaar + DL approved' },
    { id: 'CITY', label: 'By city', hint: 'Profile city or listing location' },
];

const APPLIES = [
    { id: 'ALL', label: 'Cars and bikes' },
    { id: 'CAR', label: 'Cars only' },
    { id: 'BIKE', label: 'Bikes and scooters only' },
];

const tomorrow = () => format(new Date(Date.now() + 86400000), 'yyyy-MM-dd');
const inAYear = () => format(new Date(Date.now() + 365 * 86400000), 'yyyy-MM-dd');

const EMPTY = {
    kind: 'DISCOUNT',
    title: '',
    message: '',
    audience: 'ALL',
    city: '',
    discountType: 'PERCENT',
    discountValue: '',
    maxDiscount: '',
    minBookingAmount: '',
    appliesTo: 'ALL',
    usesPerUser: 1,
    validUntil: '',
    creditAmount: '',
    creditExpiresAt: '',
};

function RadioCards({ legend, name, options, value, onChange }) {
    return (
        <fieldset className="adm-audience">
            <legend>{legend}</legend>
            {options.map((o) => (
                <label key={o.id} className={value === o.id ? 'is-selected' : ''}>
                    <input type="radio" name={name} value={o.id} checked={value === o.id} onChange={() => onChange(o.id)} />
                    <strong>{o.label}</strong>
                    {o.hint && <small>{o.hint}</small>}
                </label>
            ))}
        </fieldset>
    );
}

/** Pick individual people for an offer. */
function PeoplePicker({ selected, onChange }) {
    const [q, setQ] = useState('');
    const [results, setResults] = useState([]);

    useEffect(() => {
        if (q.trim().length < 2) { setResults([]); return undefined; }
        const t = setTimeout(async () => {
            try {
                const res = await adminApi.search(q.trim());
                setResults((res.data.data.users || []).filter((u) => u.role !== 'ADMIN' && !u.isBanned));
            } catch {
                setResults([]);
            }
        }, 300);
        return () => clearTimeout(t);
    }, [q]);

    const chosen = new Set(selected.map((u) => u.id));
    return (
        <div className="adm-people-picker">
            <label>
                <span>Find people <small>(name, email or phone)</small></span>
                <input className="form-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Start typing a name…" />
            </label>
            {results.length > 0 && (
                <ul className="adm-people-results">
                    {results.map((u) => (
                        <li key={u.id}>
                            <span>{u.name} <small>{u.email || ''}</small></span>
                            <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                disabled={chosen.has(u.id)}
                                onClick={() => onChange([...selected, { id: u.id, name: u.name, email: u.email }])}
                            >
                                {chosen.has(u.id) ? 'Added' : 'Add'}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {selected.length > 0 && (
                <ul className="adm-people-chips" aria-label="Selected people">
                    {selected.map((u) => (
                        <li key={u.id}>
                            {u.name}
                            <button type="button" aria-label={`Remove ${u.name}`} onClick={() => onChange(selected.filter((x) => x.id !== u.id))}>×</button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

/** Create rental discounts and wallet credits for everyone, a segment, or chosen people. */
export default function AdminOffers() {
    const [form, setForm] = useState(EMPTY);
    const [people, setPeople] = useState([]);
    const [recipients, setRecipients] = useState(null);
    const [offers, setOffers] = useState([]);
    const [sending, setSending] = useState(false);
    const set = (patch) => setForm((f) => ({ ...f, ...patch }));

    const loadOffers = useCallback(async () => {
        try {
            const res = await adminApi.getOffers();
            setOffers(res.data.data);
        } catch { /* list is optional */ }
    }, []);
    useEffect(() => { loadOffers(); }, [loadOffers]);

    const userIds = useMemo(() => people.map((p) => p.id), [people]);

    // Live count of who would get it
    useEffect(() => {
        if (form.audience === 'CITY' && form.city.trim().length < 2) { setRecipients(null); return undefined; }
        if (form.audience === 'SELECTED' && !userIds.length) { setRecipients(0); return undefined; }
        const t = setTimeout(async () => {
            try {
                const res = await adminApi.previewOffer({ audience: form.audience, city: form.city, userIds });
                setRecipients(res.data.data.recipients);
            } catch {
                setRecipients(null);
            }
        }, 350);
        return () => clearTimeout(t);
    }, [form.audience, form.city, userIds]);

    const isCredit = form.kind === 'CREDIT';
    const totalCredit = isCredit && recipients ? Number(form.creditAmount || 0) * recipients : 0;
    const ready = recipients > 0
        && form.title.trim().length >= 3
        && form.message.trim().length >= 5
        && (isCredit ? Number(form.creditAmount) > 0 : Number(form.discountValue) > 0 && Boolean(form.validUntil));

    const describe = () => {
        if (isCredit) {
            return `${formatMoney(Number(form.creditAmount))} wallet credit each${form.creditExpiresAt ? `, expiring ${format(new Date(`${form.creditExpiresAt}T00:00:00`), 'd MMM yyyy')}` : ', no expiry'}`;
        }
        const off = form.discountType === 'PERCENT' ? `${form.discountValue}% off` : `${formatMoney(Number(form.discountValue))} off`;
        return `${off} ${APPLIES.find((a) => a.id === form.appliesTo).label.toLowerCase()}, until ${format(new Date(`${form.validUntil}T00:00:00`), 'd MMM yyyy')}`;
    };

    const send = async (e) => {
        e.preventDefault();
        const who = form.audience === 'SELECTED' ? `${recipients} selected ${recipients === 1 ? 'person' : 'people'}` : `${recipients} ${recipients === 1 ? 'person' : 'people'}`;
        const money = isCredit ? `\n\nThis adds ${formatMoney(totalCredit)} of credit in total, straight away.` : '\n\nPickAndSync pays each discount; hosts still get their full price.';
        if (!window.confirm(`Send “${form.title}” (${describe()}) to ${who}?${money}\n\nThis can't be undone.`)) return;
        setSending(true);
        try {
            const payload = { ...form, userIds };
            const res = await adminApi.createOffer(payload);
            const d = res.data.data;
            if (isCredit && d.failed) toast.error(`Credited ${d.credited}; ${d.failed} failed. Check the server log.`);
            else toast.success(`Sent to ${d.recipients} ${d.recipients === 1 ? 'person' : 'people'}.`);
            setForm({ ...EMPTY, kind: form.kind });
            setPeople([]);
            loadOffers();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not send the offer.');
        } finally {
            setSending(false);
        }
    };

    const endOffer = async (offer) => {
        if (!window.confirm(`End “${offer.title}”? The discount stops applying immediately. Credit already given stays in wallets.`)) return;
        try {
            await adminApi.endOffer(offer.id);
            toast.success('Offer ended.');
            loadOffers();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not end the offer.');
        }
    };

    return (
        <div className="adm-broadcast">
            <form className="adm-edit-form" onSubmit={send}>
                <RadioCards legend="What kind of offer?" name="kind" options={KINDS} value={form.kind} onChange={(kind) => set({ kind })} />

                <label>
                    <span>Title <small>({form.title.length}/80)</small></span>
                    <input className="form-input" maxLength={80} placeholder={isCredit ? 'e.g. Diwali bonus' : 'e.g. Bike week: 20% off'} value={form.title} onChange={(e) => set({ title: e.target.value })} />
                </label>
                <label>
                    <span>Message <small>({form.message.length}/500)</small></span>
                    <textarea className="form-input" rows={3} maxLength={500} value={form.message} onChange={(e) => set({ message: e.target.value })} />
                </label>

                {isCredit ? (
                    <div className="adm-offer-grid">
                        <label>
                            <span>Credit per person (₹, up to 5,000)</span>
                            <input className="form-input" type="number" min="1" max="5000" value={form.creditAmount} onChange={(e) => set({ creditAmount: e.target.value })} />
                        </label>
                        <label>
                            <span>Expires on <small>(optional)</small></span>
                            <input className="form-input" type="date" min={tomorrow()} max={inAYear()} value={form.creditExpiresAt} onChange={(e) => set({ creditExpiresAt: e.target.value })} />
                        </label>
                    </div>
                ) : (
                    <>
                        <div className="adm-offer-grid">
                            <label>
                                <span>Discount</span>
                                <select className="form-input" value={form.discountType} onChange={(e) => set({ discountType: e.target.value })}>
                                    <option value="PERCENT">Percentage (%)</option>
                                    <option value="FLAT">Fixed amount (₹)</option>
                                </select>
                            </label>
                            <label>
                                <span>{form.discountType === 'PERCENT' ? 'Percent off (1–90)' : '₹ off (up to 10,000)'}</span>
                                <input className="form-input" type="number" min="1" max={form.discountType === 'PERCENT' ? 90 : 10000} value={form.discountValue} onChange={(e) => set({ discountValue: e.target.value })} />
                            </label>
                            {form.discountType === 'PERCENT' && (
                                <label>
                                    <span>Max discount (₹) <small>(optional)</small></span>
                                    <input className="form-input" type="number" min="1" value={form.maxDiscount} onChange={(e) => set({ maxDiscount: e.target.value })} />
                                </label>
                            )}
                            <label>
                                <span>Minimum booking (₹) <small>(optional)</small></span>
                                <input className="form-input" type="number" min="0" value={form.minBookingAmount} onChange={(e) => set({ minBookingAmount: e.target.value })} />
                            </label>
                            <label>
                                <span>Applies to</span>
                                <select className="form-input" value={form.appliesTo} onChange={(e) => set({ appliesTo: e.target.value })}>
                                    {APPLIES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                                </select>
                            </label>
                            <label>
                                <span>Uses per person</span>
                                <input className="form-input" type="number" min="1" max="10" value={form.usesPerUser} onChange={(e) => set({ usesPerUser: Number(e.target.value) })} />
                            </label>
                            <label>
                                <span>Ends on</span>
                                <input className="form-input" type="date" required min={tomorrow()} max={inAYear()} value={form.validUntil} onChange={(e) => set({ validUntil: e.target.value })} />
                            </label>
                        </div>
                        <p className="adm-inline-note">Applied automatically at payment (the biggest one if several match). A booking always costs at least ₹1. Hosts still receive their full price.</p>
                    </>
                )}

                <RadioCards legend="Who gets it?" name="audience" options={AUDIENCES} value={form.audience} onChange={(audience) => set({ audience })} />
                {form.audience === 'CITY' && (
                    <label>
                        <span>City</span>
                        <input className="form-input" placeholder="e.g. Bengaluru" value={form.city} onChange={(e) => set({ city: e.target.value })} />
                    </label>
                )}
                {form.audience === 'SELECTED' && <PeoplePicker selected={people} onChange={setPeople} />}

                <div className="admin-actions">
                    <button type="submit" className="btn btn-primary" disabled={sending || !ready}>
                        {sending ? 'Sending…' : `Send to ${recipients ?? '…'} ${recipients === 1 ? 'person' : 'people'}`}
                    </button>
                    <span className="adm-inline-note">
                        {isCredit && totalCredit > 0 ? `${formatMoney(totalCredit)} in total. ` : ''}
                        They get an in-app notification, and it shows in their wallet.
                    </span>
                </div>
            </form>

            <section>
                <h3 className="adm-subhead">Offers</h3>
                <div className="admin-table-wrap">
                    <table className="admin-table">
                        <thead>
                            <tr><th>Sent</th><th>Offer</th><th>Audience</th><th>People</th><th>Result</th><th>Status</th><th /></tr>
                        </thead>
                        <tbody>
                            {offers.length === 0 ? <tr><td colSpan="7">No offers yet.</td></tr> : offers.map((o) => (
                                <tr key={o.id}>
                                    <td>{format(new Date(o.createdAt), 'd MMM yyyy')}<br /><small>{o.createdBy?.name || '—'}</small></td>
                                    <td>
                                        <strong>{o.title}</strong><br />
                                        <small>{o.summary}{o.kind === 'DISCOUNT' && o.validUntil ? ` · until ${format(new Date(o.validUntil), 'd MMM')}` : ''}{o.kind === 'CREDIT' && o.creditExpiresAt ? ` · expires ${format(new Date(o.creditExpiresAt), 'd MMM')}` : ''}</small>
                                    </td>
                                    <td>{AUDIENCES.find((a) => a.id === o.audience)?.label || o.audience}{o.city ? ` · ${o.city}` : ''}</td>
                                    <td>{o.recipients}</td>
                                    <td>
                                        {o.kind === 'DISCOUNT'
                                            ? <>{o.stats.uses} used<br /><small>{formatMoney(o.stats.discountGiven)} discounted</small></>
                                            : <>{formatMoney(o.stats.creditGiven)} given<br /><small>{formatMoney(o.stats.creditUnspent)} unspent</small></>}
                                    </td>
                                    <td>
                                        <span className={`badge ${o.status === 'ACTIVE' && (!o.validUntil || new Date(o.validUntil) > new Date()) ? 'badge-success' : 'badge-neutral'}`}>
                                            {o.status === 'ENDED' ? 'Ended' : o.validUntil && new Date(o.validUntil) <= new Date() ? 'Expired' : 'Active'}
                                        </span>
                                    </td>
                                    <td>
                                        {o.kind === 'DISCOUNT' && o.status === 'ACTIVE' && (
                                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => endOffer(o)}>End</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
