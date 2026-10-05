import { useEffect, useRef, useState } from 'react';
import { adminApi } from '../../api/index.js';
import { formatMoney } from '../../config/markets.js';

const GROUPS = [
    ['users', 'People'],
    ['bookings', 'Bookings'],
    ['payments', 'Payments'],
    ['transactions', 'Wallet'],
    ['vehicles', 'Vehicles'],
    ['trips', 'Trips'],
    ['reports', 'Reports'],
];

function describe(group, item) {
    switch (group) {
        case 'users': return { title: item.name, sub: `${item.email || ''}${item.role === 'ADMIN' ? ' · admin' : ''}${item.isBanned ? ' · banned' : ''}` };
        case 'bookings': return { title: `${item.listing.vehicle.make} ${item.listing.vehicle.model} · ${item.listing.vehicle.licensePlate}`, sub: `${item.renter.name} · ${item.status} · ${formatMoney(item.totalPrice)}` };
        case 'payments': return { title: `${formatMoney(item.amount)} · ${item.status}`, sub: `${item.user?.name || ''} · ${item.stripePaymentId}` };
        case 'transactions': return { title: `${item.type} ${formatMoney(item.amount)} · ${item.status}`, sub: `${item.wallet?.user?.name || ''} · ${item.referenceId || ''}` };
        case 'vehicles': return { title: `${item.make} ${item.model} · ${item.licensePlate}`, sub: `${item.owner?.name || ''}${item.isVerified ? ' · verified' : ' · not verified'}` };
        case 'trips': return { title: item.title, sub: `${item.destination} · ${item.status}` };
        case 'reports': return { title: item.subject, sub: `${item.priority} · ${item.status}` };
        default: return { title: '', sub: '' };
    }
}

/**
 * One box for everything: name, email, phone, plate, booking/payment id,
 * UTR, UPI id, referral code or report title.
 */
export default function AdminSearch({ onOpenUser, onOpenTrip, onOpenReport }) {
    const [q, setQ] = useState('');
    const [results, setResults] = useState(null);
    const [open, setOpen] = useState(false);
    const boxRef = useRef(null);

    useEffect(() => {
        if (q.trim().length < 2) { setResults(null); return undefined; }
        const t = setTimeout(async () => {
            try {
                const res = await adminApi.search(q.trim());
                setResults(res.data.data);
                setOpen(true);
            } catch {
                setResults(null);
            }
        }, 300);
        return () => clearTimeout(t);
    }, [q]);

    useEffect(() => {
        const onDoc = (e) => { if (!boxRef.current?.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, []);

    const pick = (group, item) => {
        setOpen(false);
        if (group === 'users') onOpenUser(item.id);
        else if (group === 'bookings') onOpenUser(item.renter.id);
        else if (group === 'payments') onOpenUser(item.user.id);
        else if (group === 'transactions') onOpenUser(item.wallet.user.id);
        else if (group === 'vehicles') onOpenUser(item.owner.id);
        else if (group === 'trips') onOpenTrip(item.title);
        else if (group === 'reports') onOpenReport(item.id);
    };

    const total = results ? GROUPS.reduce((n, [key]) => n + (results[key]?.length || 0), 0) : 0;

    return (
        <div className="adm-search" ref={boxRef}>
            <input
                type="search"
                className="form-input"
                placeholder="Search people, plates, bookings, UTR, reports…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onFocus={() => results && setOpen(true)}
                onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
                aria-label="Search admin"
            />
            {open && results && (
                <div className="adm-search-results" role="listbox">
                    {total === 0 ? <p className="text-muted">No matches for “{q}”.</p> : GROUPS.map(([key, label]) => (
                        results[key]?.length ? (
                            <div key={key}>
                                <h4>{label}</h4>
                                {results[key].map((item) => {
                                    const d = describe(key, item);
                                    return (
                                        <button key={item.id} type="button" role="option" aria-selected="false" onClick={() => pick(key, item)}>
                                            <strong>{d.title}</strong>
                                            <small>{d.sub}</small>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : null
                    ))}
                </div>
            )}
        </div>
    );
}
