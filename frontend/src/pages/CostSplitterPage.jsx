import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatMoney } from '../config/markets.js';
import CustomerAppLink from '../components/CustomerAppLink.jsx';
import { computeSplit, decodeState, encodeState } from '../utils/splitCalculator.js';
import { copyLink, whatsappUrl } from '../utils/share.js';
import { trackWebsiteEvent } from '../utils/websiteGrowth.js';
import useSeo from '../hooks/useSeo.js';
import { ROUTE_SEO, TRIP_SPLITTER_HEADER } from '../seo/seoConfig.js';
import './Destinations.css';
import './CostSplitterPage.css';

const DRAFT_KEY = 'pns.splitter.v1';
let seq = 0;
const uid = (prefix) => `${prefix}${Date.now().toString(36)}${(seq += 1)}`;

function initialState() {
    const fromLink = window.location.hash.length > 1 ? decodeState(window.location.hash.slice(1)) : null;
    if (fromLink) return fromLink;
    try {
        const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
        if (Array.isArray(saved?.people) && Array.isArray(saved?.expenses)) return saved;
    } catch { /* ignore */ }
    return { people: [], expenses: [] };
}

const emptyExpense = { title: '', amount: '', paidBy: '', splitAmong: [] };

/** /tools/trip-cost-splitter — free, no-login expense splitter (shareable via link). */
export default function CostSplitterPage() {
    useSeo({ ...ROUTE_SEO['tools/trip-cost-splitter'], path: 'tools/trip-cost-splitter' });
    const [{ people, expenses }, setState] = useState(initialState);
    const [newName, setNewName] = useState('');
    const [form, setForm] = useState(emptyExpense);
    const [error, setError] = useState('');
    const countedSplit = useRef(expenses.length > 0 && people.length > 1);
    const countedOpen = useRef(false);

    const result = useMemo(() => computeSplit(people, expenses), [people, expenses]);

    useEffect(() => {
        try {
            localStorage.setItem(DRAFT_KEY, JSON.stringify({ people, expenses }));
        } catch { /* storage blocked */ }
    }, [people, expenses]);

    useEffect(() => {
        if (!countedOpen.current && decodeState(window.location.hash.slice(1))?.expenses.length) {
            countedOpen.current = true;
            trackWebsiteEvent('split_link_opened');
        }
    }, []);

    const shareUrl = () => {
        const url = new URL(window.location.pathname, window.location.origin);
        url.searchParams.set('utm_source', 'shared-split');
        url.hash = encodeState(people, expenses);
        return url.href;
    };
    const countCompletedSplit = () => {
        if (countedSplit.current) return;
        countedSplit.current = true;
        trackWebsiteEvent('split_completed');
    };

    const addPerson = (e) => {
        e.preventDefault();
        const name = newName.trim().slice(0, 40);
        if (!name) return;
        if (people.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
            setError(`${name} is already in the group.`);
            return;
        }
        if (people.length >= 30) {
            setError('Up to 30 people per trip.');
            return;
        }
        setError('');
        setState((s) => ({ ...s, people: [...s.people, { id: uid('p'), name }] }));
        setNewName('');
        if (people.length === 1 && expenses.length > 0) countCompletedSplit();
    };

    const removePerson = (id) => {
        if (expenses.some((x) => x.paidBy === id)) {
            setError('Remove the expenses this person paid for first.');
            return;
        }
        setError('');
        setState((s) => ({
            people: s.people.filter((p) => p.id !== id),
            expenses: s.expenses.map((x) => ({ ...x, splitAmong: x.splitAmong.filter((pid) => pid !== id) })),
        }));
    };

    const addExpense = (e) => {
        e.preventDefault();
        const amount = Number(form.amount);
        if (!form.title.trim()) return setError('Add what the expense was for.');
        if (!Number.isFinite(amount) || amount <= 0) return setError('Enter an amount greater than zero.');
        const paidBy = form.paidBy || people[0]?.id;
        if (!paidBy) return setError('Add people to the group first.');
        setError('');
        setState((s) => ({
            ...s,
            expenses: [...s.expenses, {
                id: uid('e'),
                title: form.title.trim().slice(0, 80),
                amount,
                paidBy,
                splitAmong: form.splitAmong,
            }],
        }));
        setForm({ ...emptyExpense, paidBy });
        if (people.length > 1) countCompletedSplit();
    };

    const toggleSplit = (id) => {
        setForm((f) => ({
            ...f,
            splitAmong: f.splitAmong.includes(id) ? f.splitAmong.filter((x) => x !== id) : [...f.splitAmong, id],
        }));
    };

    const reset = () => {
        if (!window.confirm('Clear all people and expenses?')) return;
        countedSplit.current = false;
        setState({ people: [], expenses: [] });
        window.history.replaceState(null, '', window.location.pathname);
    };

    const nameOf = (id) => people.find((p) => p.id === id)?.name || '—';
    const summaryText = result.settlements.length
        ? result.settlements.map((t) => `${t.fromName} pays ${t.toName} ${formatMoney(t.amount)}`).join('\n')
        : 'Everyone is settled up.';

    return (
        <div className="dst-page page-atmosphere page-enter">
            <div className="container">
                <header className="dst-header">
                    <p className="dst-kicker">{TRIP_SPLITTER_HEADER.kicker}</p>
                    <h1>{TRIP_SPLITTER_HEADER.title}</h1>
                    <p className="dst-lead">{TRIP_SPLITTER_HEADER.intro}</p>
                </header>

                {error && <p className="splitter-error" role="alert">{error}</p>}

                <div className="splitter-grid">
                    <section className="splitter-panel">
                        <h2>1. Who&apos;s on the trip?</h2>
                        <form className="splitter-inline" onSubmit={addPerson}>
                            <input
                                className="form-input"
                                placeholder="Name"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                aria-label="Person's name"
                            />
                            <button type="submit" className="btn btn-primary">Add</button>
                        </form>
                        <ul className="splitter-chips">
                            {people.map((p) => (
                                <li key={p.id}>
                                    {p.name}
                                    <button type="button" onClick={() => removePerson(p.id)} aria-label={`Remove ${p.name}`}>×</button>
                                </li>
                            ))}
                        </ul>
                    </section>

                    <section className="splitter-panel">
                        <h2>2. Add expenses</h2>
                        <form className="splitter-form" onSubmit={addExpense}>
                            <input
                                className="form-input"
                                placeholder="What for? e.g. Car rental"
                                value={form.title}
                                onChange={(e) => setForm({ ...form, title: e.target.value })}
                                aria-label="Expense description"
                            />
                            <div className="splitter-inline">
                                <input
                                    className="form-input"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    inputMode="decimal"
                                    placeholder="Amount (₹)"
                                    value={form.amount}
                                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                                    aria-label="Amount"
                                />
                                <select
                                    className="form-input"
                                    value={form.paidBy || people[0]?.id || ''}
                                    onChange={(e) => setForm({ ...form, paidBy: e.target.value })}
                                    aria-label="Paid by"
                                    disabled={!people.length}
                                >
                                    {people.length === 0 && <option value="">Add people first</option>}
                                    {people.map((p) => <option key={p.id} value={p.id}>Paid by {p.name}</option>)}
                                </select>
                            </div>
                            {people.length > 0 && (
                                <fieldset className="splitter-split">
                                    <legend>Split between {form.splitAmong.length ? '' : '(everyone)'}</legend>
                                    {people.map((p) => (
                                        <label key={p.id}>
                                            <input
                                                type="checkbox"
                                                checked={form.splitAmong.includes(p.id)}
                                                onChange={() => toggleSplit(p.id)}
                                            />
                                            {p.name}
                                        </label>
                                    ))}
                                </fieldset>
                            )}
                            <button type="submit" className="btn btn-primary" disabled={!people.length}>Add expense</button>
                        </form>

                        {expenses.length > 0 && (
                            <ul className="splitter-expenses">
                                {expenses.map((x) => (
                                    <li key={x.id}>
                                        <span>
                                            <strong>{x.title}</strong>
                                            <small>
                                                {nameOf(x.paidBy)} paid ·{' '}
                                                {x.splitAmong.length ? x.splitAmong.map(nameOf).join(', ') : 'everyone'}
                                            </small>
                                        </span>
                                        <span className="splitter-amount">{formatMoney(x.amount)}</span>
                                        <button
                                            type="button"
                                            onClick={() => setState((s) => ({ ...s, expenses: s.expenses.filter((e) => e.id !== x.id) }))}
                                            aria-label={`Delete ${x.title}`}
                                        >
                                            ×
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </div>

                <section className="splitter-panel splitter-result" aria-live="polite">
                    <h2>3. Settle up</h2>
                    {people.length === 0 || expenses.length === 0 ? (
                        <p className="text-muted">Add people and at least one expense to see who owes whom.</p>
                    ) : (
                        <>
                            <p className="splitter-total">Total spent: <strong>{formatMoney(result.total)}</strong></p>
                            <div className="splitter-table-wrap">
                                <table className="splitter-table">
                                    <thead>
                                        <tr><th>Person</th><th>Paid</th><th>Share</th><th>Balance</th></tr>
                                    </thead>
                                    <tbody>
                                        {result.balances.map((b) => (
                                            <tr key={b.id}>
                                                <td>{b.name}</td>
                                                <td>{formatMoney(b.paid)}</td>
                                                <td>{formatMoney(b.share)}</td>
                                                <td className={b.net > 0 ? 'pos' : b.net < 0 ? 'neg' : ''}>
                                                    {b.net > 0 ? 'gets ' : b.net < 0 ? 'owes ' : ''}{formatMoney(Math.abs(b.net))}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <ul className="splitter-settlements">
                                {result.settlements.length === 0
                                    ? <li>Everyone is settled up.</li>
                                    : result.settlements.map((t) => (
                                        <li key={`${t.from}-${t.to}`}>
                                            <strong>{t.fromName}</strong> pays <strong>{t.toName}</strong> {formatMoney(t.amount)}
                                        </li>
                                    ))}
                            </ul>
                            <div className="dst-actions">
                                <a
                                    className="btn btn-primary"
                                    href={whatsappUrl(`Our trip split (total ${formatMoney(result.total)}):\n${summaryText}\n\nSee the details:\n${shareUrl()}`)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => trackWebsiteEvent('split_share_opened')}
                                >
                                    Share on WhatsApp
                                </a>
                                <button type="button" className="btn btn-ghost" onClick={() => copyLink(shareUrl())}>Copy link</button>
                                <button type="button" className="btn btn-ghost" onClick={reset}>Start over</button>
                            </div>
                        </>
                    )}
                </section>

                <section className="dst-section splitter-cta card">
                    <h2>Planning a real trip?</h2>
                    <p>
                        Create the trip on PickAndSync to invite friends with one link, chat, build the itinerary
                        and track expenses together as you go.
                    </p>
                    <div className="dst-actions">
                        <Link to="/trips/create" className="btn btn-primary">Plan a group trip</Link>
                        <CustomerAppLink placement="splitter" className="btn btn-ghost" />
                        <Link to="/guides/how-to-split-trip-expenses-with-friends/" className="btn btn-ghost">
                            How to split costs fairly
                        </Link>
                    </div>
                    <p className="text-muted" style={{ marginTop: 14 }}>
                        Used Splitwise or Tricount before?{' '}
                        <Link to="/split-expenses-app">See how PickAndSync compares</Link> — it settles up over UPI, not just tracks.
                    </p>
                </section>
            </div>
        </div>
    );
}
