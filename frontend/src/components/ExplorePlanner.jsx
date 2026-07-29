import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { exploreApi } from '../api/index.js';
import { useAuthStore } from '../store/authStore.js';
import './ExplorePlanner.css';

const emptyForm = () => {
    const start = new Date();
    start.setDate(start.getDate() + 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 2);
    return {
        destination: '',
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
        pace: 'balanced',
        budget: 'mid',
        travelerType: 'friends',
        interests: [],
        notes: '',
    };
};

export default function ExplorePlanner({ onPlanPlaces, selectedId, onSelectStop }) {
    const user = useAuthStore((s) => s.user);
    const [meta, setMeta] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [plan, setPlan] = useState(null);
    const [savedList, setSavedList] = useState([]);
    const [view, setView] = useState('form'); // form | plan | list
    const [loading, setLoading] = useState(false);
    const [activeDay, setActiveDay] = useState(1);
    const [editingStopId, setEditingStopId] = useState(null);
    const [editDraft, setEditDraft] = useState({ name: '', notes: '', startTime: '', endTime: '' });

    useEffect(() => {
        exploreApi.getPlannerMeta().then((res) => setMeta(res.data.data)).catch(() => {});
    }, []);

    useEffect(() => {
        if (!user) return;
        exploreApi.listPlans()
            .then((res) => setSavedList(res.data.data || []))
            .catch(() => {});
    }, [user]);

    useEffect(() => {
        onPlanPlaces?.(plan?.mapPlaces || []);
    }, [plan, onPlanPlaces]);

    const interestOptions = meta?.interestSuggestions || [
        'food', 'coffee', 'nightlife', 'nature', 'shopping', 'history',
    ];

    const activeDayData = useMemo(
        () => plan?.days?.find((d) => d.dayNumber === activeDay) || plan?.days?.[0],
        [plan, activeDay],
    );

    const applyPlan = (next) => {
        setPlan(next);
        setActiveDay(next?.days?.[0]?.dayNumber || 1);
        setView('plan');
        onPlanPlaces?.(next?.mapPlaces || []);
    };

    const toggleInterest = (tag) => {
        setForm((prev) => {
            const has = prev.interests.includes(tag);
            return {
                ...prev,
                interests: has
                    ? prev.interests.filter((t) => t !== tag)
                    : [...prev.interests, tag].slice(0, 8),
            };
        });
    };

    const generate = async (e) => {
        e?.preventDefault();
        if (!user) return toast.error('Log in to generate and save plans.');
        if (!form.destination.trim()) return toast.error('Enter a destination.');
        setLoading(true);
        try {
            const res = await exploreApi.generatePlan(form);
            applyPlan(res.data.data);
            toast.success(res.data.message || 'Plan ready.');
            const list = await exploreApi.listPlans();
            setSavedList(list.data.data || []);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not generate plan.');
        } finally {
            setLoading(false);
        }
    };

    const loadPlan = async (id) => {
        setLoading(true);
        try {
            const res = await exploreApi.getPlan(id);
            applyPlan(res.data.data);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not open plan.');
        } finally {
            setLoading(false);
        }
    };

    const regenerate = async (dayNumber = null) => {
        if (!plan?.id) return;
        setLoading(true);
        try {
            const res = await exploreApi.regeneratePlan(plan.id, dayNumber ? { dayNumber } : {});
            applyPlan(res.data.data);
            toast.success(res.data.message || 'Regenerated.');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Regenerate failed.');
        } finally {
            setLoading(false);
        }
    };

    const savePlan = async () => {
        if (!plan?.id) return;
        setLoading(true);
        try {
            const res = await exploreApi.savePlan(plan.id);
            setPlan(res.data.data);
            toast.success('Plan saved.');
            const list = await exploreApi.listPlans();
            setSavedList(list.data.data || []);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Save failed.');
        } finally {
            setLoading(false);
        }
    };

    const deletePlan = async () => {
        if (!plan?.id || !window.confirm('Delete this plan?')) return;
        setLoading(true);
        try {
            await exploreApi.deletePlan(plan.id);
            toast.success('Plan deleted.');
            setPlan(null);
            setView('form');
            onPlanPlaces?.([]);
            const list = await exploreApi.listPlans();
            setSavedList(list.data.data || []);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Delete failed.');
        } finally {
            setLoading(false);
        }
    };

    const beginEdit = (stop) => {
        setEditingStopId(stop.id);
        setEditDraft({
            name: stop.name || '',
            notes: stop.notes || '',
            startTime: stop.startTime || '',
            endTime: stop.endTime || '',
        });
    };

    const commitEdit = async () => {
        if (!plan?.id || !editingStopId) return;
        setLoading(true);
        try {
            const res = await exploreApi.updatePlanStop(plan.id, editingStopId, editDraft);
            applyPlan(res.data.data);
            setEditingStopId(null);
            toast.success('Stop updated.');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Update failed.');
        } finally {
            setLoading(false);
        }
    };

    const removeStop = async (stopId) => {
        if (!plan?.id || !window.confirm('Remove this stop?')) return;
        setLoading(true);
        try {
            const res = await exploreApi.deletePlanStop(plan.id, stopId);
            applyPlan(res.data.data);
            toast.success('Stop removed.');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not remove stop.');
        } finally {
            setLoading(false);
        }
    };

    if (!user) {
        return (
            <div className="explore-planner locked">
                <p className="explore-kicker">AI trip planner</p>
                <h2 className="font-display">Plan days, not just places</h2>
                <p>
                    <Link to="/login">Log in</Link> to generate a day-by-day itinerary, edit stops,
                    regenerate days, and save plans.
                </p>
            </div>
        );
    }

    return (
        <div className="explore-planner">
            <div className="explore-planner-tabs">
                <button type="button" className={view === 'form' ? 'active' : ''} onClick={() => setView('form')}>
                    New plan
                </button>
                <button
                    type="button"
                    className={view === 'plan' ? 'active' : ''}
                    onClick={() => setView(plan ? 'plan' : 'form')}
                    disabled={!plan}
                >
                    Itinerary
                </button>
                <button type="button" className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>
                    Saved ({savedList.length})
                </button>
            </div>

            {view === 'form' && (
                <form className="explore-planner-form" onSubmit={generate}>
                    <p className="explore-kicker">AI trip planner</p>
                    <h2 className="font-display">Build your days</h2>
                    <p className="explore-planner-lead">
                        Destination, dates, pace, budget, and traveler type → ordered day plans.
                        {meta && (
                            <span> · OpenAI {meta.openai ? 'on' : 'heuristic fallback'}</span>
                        )}
                    </p>

                    <label>
                        Destination
                        <input
                            value={form.destination}
                            onChange={(e) => setForm({ ...form, destination: e.target.value })}
                            placeholder="e.g. Coorg, Goa, Jaipur"
                            required
                            maxLength={120}
                        />
                    </label>

                    <div className="explore-planner-row">
                        <label>
                            Start
                            <input
                                type="date"
                                value={form.startDate}
                                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                                required
                            />
                        </label>
                        <label>
                            End
                            <input
                                type="date"
                                value={form.endDate}
                                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                                required
                            />
                        </label>
                    </div>

                    <label>
                        Pace
                        <select value={form.pace} onChange={(e) => setForm({ ...form, pace: e.target.value })}>
                            <option value="relaxed">Relaxed — fewer stops</option>
                            <option value="balanced">Balanced</option>
                            <option value="packed">Packed — more stops</option>
                        </select>
                    </label>

                    <label>
                        Budget
                        <select value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })}>
                            <option value="budget">Budget</option>
                            <option value="mid">Mid-range</option>
                            <option value="luxury">Luxury</option>
                        </select>
                    </label>

                    <label>
                        Traveler type
                        <select
                            value={form.travelerType}
                            onChange={(e) => setForm({ ...form, travelerType: e.target.value })}
                        >
                            {(meta?.travelerTypes || ['solo', 'couple', 'family', 'friends', 'work', 'backpacker']).map((t) => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                    </label>

                    <div className="explore-planner-interests">
                        <span>Interests</span>
                        <div>
                            {interestOptions.map((tag) => (
                                <button
                                    key={tag}
                                    type="button"
                                    className={form.interests.includes(tag) ? 'on' : ''}
                                    onClick={() => toggleInterest(tag)}
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>
                    </div>

                    <label>
                        Notes (optional)
                        <textarea
                            rows={2}
                            value={form.notes}
                            onChange={(e) => setForm({ ...form, notes: e.target.value })}
                            placeholder="No early mornings, vegetarian, near beach…"
                            maxLength={500}
                        />
                    </label>

                    <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                        {loading ? 'Generating…' : 'Generate itinerary'}
                    </button>
                </form>
            )}

            {view === 'list' && (
                <div className="explore-planner-list">
                    <h2 className="font-display">Your plans</h2>
                    {savedList.length === 0 ? (
                        <p className="muted">No plans yet — generate one from New plan.</p>
                    ) : (
                        savedList.map((p) => (
                            <button
                                key={p.id}
                                type="button"
                                className="explore-plan-row"
                                onClick={() => loadPlan(p.id)}
                                disabled={loading}
                            >
                                <strong>{p.title}</strong>
                                <span>
                                    {p.destination} · {p.dayCount} days · {p.status}
                                </span>
                                <span className="muted">
                                    Updated {p.updatedAt ? format(new Date(p.updatedAt), 'MMM d') : ''}
                                </span>
                            </button>
                        ))
                    )}
                </div>
            )}

            {view === 'plan' && plan && (
                <div className="explore-planner-result">
                    <header className="explore-planner-result-head">
                        <div>
                            <p className="explore-kicker">{plan.status} · {plan.source || 'plan'}</p>
                            <h2 className="font-display">{plan.title}</h2>
                            <p className="muted">{plan.summary}</p>
                            <p className="muted">
                                {plan.destination} · {plan.travelerType} · {plan.pace} · {plan.budget}
                            </p>
                        </div>
                    </header>

                    <div className="explore-planner-actions">
                        <button type="button" className="btn btn-primary btn-sm" onClick={savePlan} disabled={loading || plan.status === 'SAVED'}>
                            {plan.status === 'SAVED' ? 'Saved' : 'Save plan'}
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => regenerate()} disabled={loading}>
                            Regenerate all
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setView('form')} disabled={loading}>
                            New
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={deletePlan} disabled={loading}>
                            Delete
                        </button>
                    </div>

                    <div className="explore-day-tabs">
                        {plan.days?.map((d) => (
                            <button
                                key={d.id || d.dayNumber}
                                type="button"
                                className={activeDay === d.dayNumber ? 'active' : ''}
                                onClick={() => setActiveDay(d.dayNumber)}
                            >
                                Day {d.dayNumber}
                            </button>
                        ))}
                    </div>

                    {activeDayData && (
                        <section className="explore-day-panel">
                            <div className="explore-day-panel-head">
                                <div>
                                    <h3>{activeDayData.title}</h3>
                                    {activeDayData.theme && <p className="muted">Theme: {activeDayData.theme}</p>}
                                    {activeDayData.summary && <p className="muted">{activeDayData.summary}</p>}
                                </div>
                                <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => regenerate(activeDayData.dayNumber)}
                                    disabled={loading}
                                >
                                    Regen day
                                </button>
                            </div>

                            <ol className="explore-stop-list">
                                {(activeDayData.stops || []).map((stop, idx) => (
                                    <li
                                        key={stop.id || idx}
                                        className={selectedId === stop.id ? 'selected' : ''}
                                    >
                                        <button
                                            type="button"
                                            className="explore-stop-main"
                                            onClick={() => onSelectStop?.(stop)}
                                        >
                                            <span className="explore-stop-time">
                                                {stop.startTime || '—'}
                                                {stop.endTime ? `–${stop.endTime}` : ''}
                                            </span>
                                            <span className="explore-stop-body">
                                                <strong>{stop.name}</strong>
                                                {stop.address && <em>{stop.address}</em>}
                                                {stop.reason && <em className="reason">{stop.reason}</em>}
                                                <span className="explore-stop-meta">
                                                    {stop.category} · {stop.energy || 'medium'} energy
                                                </span>
                                            </span>
                                        </button>

                                        {editingStopId === stop.id ? (
                                            <div className="explore-stop-edit">
                                                <input
                                                    value={editDraft.name}
                                                    onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                                                    placeholder="Name"
                                                />
                                                <div className="explore-planner-row">
                                                    <input
                                                        value={editDraft.startTime}
                                                        onChange={(e) => setEditDraft({ ...editDraft, startTime: e.target.value })}
                                                        placeholder="Start HH:MM"
                                                    />
                                                    <input
                                                        value={editDraft.endTime}
                                                        onChange={(e) => setEditDraft({ ...editDraft, endTime: e.target.value })}
                                                        placeholder="End HH:MM"
                                                    />
                                                </div>
                                                <input
                                                    value={editDraft.notes}
                                                    onChange={(e) => setEditDraft({ ...editDraft, notes: e.target.value })}
                                                    placeholder="Notes"
                                                />
                                                <div className="explore-planner-actions">
                                                    <button type="button" className="btn btn-primary btn-sm" onClick={commitEdit} disabled={loading}>
                                                        Save stop
                                                    </button>
                                                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingStopId(null)}>
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="explore-stop-actions">
                                                <button type="button" onClick={() => beginEdit(stop)}>Edit</button>
                                                <button type="button" onClick={() => removeStop(stop.id)}>Remove</button>
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ol>
                        </section>
                    )}
                </div>
            )}
        </div>
    );
}
