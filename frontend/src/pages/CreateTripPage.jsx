import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { tripsApi } from '../api/index.js';
import toast from 'react-hot-toast';
import LocationAutocomplete from '../components/LocationAutocomplete.jsx';
import CoverImagePicker from '../components/CoverImagePicker.jsx';
import TripCarSuggestions from '../components/TripCarSuggestions.jsx';
import './CreateTripPage.css';

const STEPS = [
    { id: 'details', label: 'Details', hint: 'Where & what' },
    { id: 'dates', label: 'Plan', hint: 'When & who' },
    { id: 'review', label: 'Publish', hint: 'Confirm' },
];

const DRAFT_KEY = 'packandsync.createTrip.draft';

const DEFAULT_FORM = {
    title: '',
    description: '',
    destination: '',
    coverImageUrl: '',
    startDate: '',
    endDate: '',
    maxParticipants: 6,
    budgetEstimate: '',
    joinMode: 'everyone',
    meetingPoint: '',
    isPublic: true,
};

function loadDraft() {
    try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        const step = Number.isInteger(parsed.step)
            ? Math.min(Math.max(parsed.step, 0), STEPS.length - 1)
            : 0;
        const form = {
            ...DEFAULT_FORM,
            ...(parsed.form && typeof parsed.form === 'object' ? parsed.form : {}),
        };
        form.maxParticipants = Number(form.maxParticipants) || 6;
        form.isPublic = form.joinMode !== 'invite';
        return { step, form };
    } catch {
        return null;
    }
}

function draftHasContent(form, step) {
    if (step > 0) return true;
    return Object.entries(form).some(([key, value]) => {
        if (key === 'maxParticipants') return Number(value) !== DEFAULT_FORM.maxParticipants;
        if (key === 'joinMode') return value !== DEFAULT_FORM.joinMode;
        if (key === 'isPublic') return false; // derived from joinMode — ignore
        return String(value ?? '').trim() !== '';
    });
}

function saveDraft(step, form) {
    try {
        if (!draftHasContent(form, step)) {
            localStorage.removeItem(DRAFT_KEY);
            return;
        }
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ step, form, savedAt: Date.now() }));
    } catch {
        /* quota / private mode */
    }
}

function clearDraft() {
    try {
        localStorage.removeItem(DRAFT_KEY);
    } catch {
        /* ignore */
    }
}

const JOIN_OPTIONS = [
    {
        id: 'everyone',
        label: 'Everyone',
        hint: 'Open to all travelers',
        icon: (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.7" />
                <circle cx="16" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.7" />
                <path d="M3.5 18c.8-2.6 2.8-4 5.5-4s4.7 1.4 5.5 4M14 14c2 .3 3.6 1.4 4.3 3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
        ),
    },
    {
        id: 'network',
        label: 'Friends-of-friends',
        hint: 'Trusted network only',
        icon: (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                <path d="M8 12a3 3 0 100-6 3 3 0 000 6zM16 13a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" stroke="currentColor" strokeWidth="1.7" />
                <path d="M3.5 19c1-3 3-4.5 5.5-4.5S13 16 14 19M14.5 15.5c1.5.3 2.8 1.2 3.5 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                <path d="M12 8.5l1.5-1.5M10.5 11.5L13 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
        ),
    },
    {
        id: 'invite',
        label: 'Invite-only',
        hint: 'Private link access',
        icon: (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.7" />
                <path d="M8.5 11V8a3.5 3.5 0 017 0v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
        ),
    },
];

const today = new Date().toISOString().slice(0, 10);

function CalendarIcon() {
    return (
        <svg className="create-input-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
            <rect x="3.5" y="5" width="17" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
            <path d="M8 3.5v3M16 3.5v3M3.5 10h17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
    );
}

function formatRange(start, end) {
    if (!start || !end) return null;
    try {
        const a = new Date(`${start}T12:00:00`);
        const b = new Date(`${end}T12:00:00`);
        const opts = { month: 'short', day: 'numeric' };
        return `${a.toLocaleDateString(undefined, opts)} – ${b.toLocaleDateString(undefined, { ...opts, year: 'numeric' })}`;
    } catch {
        return `${start} → ${end}`;
    }
}

export default function CreateTripPage() {
    const navigate = useNavigate();
    const initial = useMemo(() => loadDraft(), []);
    const [step, setStep] = useState(() => initial?.step ?? 0);
    const [isLoading, setIsLoading] = useState(false);
    const [form, setForm] = useState(() => initial?.form ?? { ...DEFAULT_FORM });
    const [restored] = useState(() => Boolean(initial));

    useEffect(() => {
        if (!restored) return;
        toast('Draft restored — pick up where you left off.', { id: 'create-trip-draft', duration: 2800 });
    }, [restored]);

    // Persist immediately whenever step/form change (not only after paint).
    useEffect(() => {
        saveDraft(step, form);
    }, [step, form]);

    const updateForm = (patch) => {
        setForm((prev) => {
            const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch };
            // Synchronous write so a hard reload right after typing still restores.
            saveDraft(step, next);
            return next;
        });
    };

    const goToStep = (nextStep) => {
        const clamped = Math.min(Math.max(nextStep, 0), STEPS.length - 1);
        setStep(clamped);
        saveDraft(clamped, form);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        updateForm({ [name]: value });
    };

    const setJoinMode = (id) => {
        updateForm({
            joinMode: id,
            isPublic: id !== 'invite',
        });
    };

    const canNext = useMemo(() => {
        if (step === 0) return Boolean(form.title.trim() && form.destination.trim());
        if (step === 1) {
            return Boolean(form.startDate && form.endDate && form.endDate >= form.startDate);
        }
        return true;
    }, [step, form]);

    const dateSummary = formatRange(form.startDate, form.endDate);
    const nights = useMemo(() => {
        if (!form.startDate || !form.endDate || form.endDate < form.startDate) return null;
        const ms = new Date(`${form.endDate}T12:00:00`) - new Date(`${form.startDate}T12:00:00`);
        return Math.max(0, Math.round(ms / 86400000));
    }, [form.startDate, form.endDate]);

    const goNext = () => {
        if (!canNext) {
            if (step === 0) toast.error('Add a trip title and destination.');
            if (step === 1) toast.error('Choose valid start and end dates.');
            return;
        }
        goToStep(step + 1);
    };

    const handleSubmit = async () => {
        if (!form.startDate || !form.endDate) {
            toast.error('Dates are required.');
            return;
        }
        setIsLoading(true);
        try {
            const descriptionParts = [form.description.trim()];
            if (form.meetingPoint.trim()) {
                descriptionParts.push(`Meeting point: ${form.meetingPoint.trim()}`);
            }
            if (form.joinMode === 'network') {
                descriptionParts.push('Join preference: friends-of-friends.');
            }

            const res = await tripsApi.create({
                title: form.title.trim(),
                destination: form.destination.trim(),
                description: descriptionParts.filter(Boolean).join('\n\n') || null,
                startDate: form.startDate,
                endDate: form.endDate,
                maxParticipants: Number(form.maxParticipants) || 6,
                budgetEstimate: form.budgetEstimate ? Number(form.budgetEstimate) : null,
                isPublic: form.isPublic,
                coverImageUrl: form.coverImageUrl || null,
            });
            toast.success('Trip posted — others can join and split costs.');
            clearDraft();
            navigate(`/trips/${res.data.data.id}`);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to create trip.');
        } finally {
            setIsLoading(false);
        }
    };

    const joinLabel = JOIN_OPTIONS.find((o) => o.id === form.joinMode)?.label || 'Everyone';

    return (
        <div className="create-trip-page page-atmosphere page-enter">
            <div className="create-glow" aria-hidden="true" />
            <div className="create-shell">
                <header className="create-hero">
                    <h1 className="font-display">Post a trip</h1>
                    <p>
                        One person creates the route. Others join, travel with you, and split shared money.
                    </p>
                </header>

                <nav className="create-stepper" aria-label="Create trip steps">
                    {STEPS.map((s, i) => (
                        <button
                            key={s.id}
                            type="button"
                            className={`create-step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}
                            onClick={() => i < step && goToStep(i)}
                            disabled={i > step}
                        >
                            <span className="create-step-index">{i < step ? '✓' : i + 1}</span>
                            <span className="create-step-copy">
                                <strong>{s.label}</strong>
                                <small>{s.hint}</small>
                            </span>
                        </button>
                    ))}
                </nav>

                <div className="create-panel">
                    {step === 0 && (
                        <div className="create-step-body">
                            <div className="create-panel-head">
                                <h2>Trip details</h2>
                                <p>Give people a clear reason to join your trip.</p>
                            </div>

                            <div className="create-fields">
                                <label className="create-field">
                                    Trip title *
                                    <input
                                        name="title"
                                        type="text"
                                        placeholder="Weekend Coorg with friends"
                                        value={form.title}
                                        onChange={handleChange}
                                        autoFocus
                                    />
                                </label>
                                <label className="create-field">
                                    Destination *
                                    <LocationAutocomplete
                                        placeholder="Search city or place (e.g. Kolkata)"
                                        value={form.destination}
                                        onChange={(val) => updateForm({
                                            destination: val,
                                            coverImageUrl: '',
                                        })}
                                        onSelect={(loc) => updateForm((f) => ({
                                            ...f,
                                            destination: loc.label || f.destination,
                                            coverImageUrl: '',
                                        }))}
                                        icon={(
                                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                                                <path d="M12 21s7-5.3 7-11a7 7 0 10-14 0c0 5.7 7 11 7 11z" stroke="currentColor" strokeWidth="1.7" />
                                                <circle cx="12" cy="10" r="2.3" stroke="currentColor" strokeWidth="1.7" />
                                            </svg>
                                        )}
                                    />
                                </label>
                                <div className="create-field">
                                    <CoverImagePicker
                                        place={form.destination}
                                        value={form.coverImageUrl}
                                        onChange={(url) => updateForm({ coverImageUrl: url })}
                                    />
                                </div>
                                <label className="create-field">
                                    Description
                                    <textarea
                                        name="description"
                                        rows="4"
                                        placeholder="Route plan, vibe, what costs you’ll split…"
                                        value={form.description}
                                        onChange={handleChange}
                                    />
                                </label>
                            </div>
                        </div>
                    )}

                    {step === 1 && (
                        <div className="create-step-body">
                            <div className="create-panel-head">
                                <h2>Plan your trip</h2>
                                <p>Define the dates, who can join, and where you’ll meet.</p>
                            </div>

                            <div className="create-fields">
                                <div className="create-section">
                                    <div className="create-section-label">
                                        <span>Dates *</span>
                                        {dateSummary && (
                                            <em>
                                                {dateSummary}
                                                {nights != null && nights > 0 ? ` · ${nights} night${nights === 1 ? '' : 's'}` : ''}
                                            </em>
                                        )}
                                    </div>
                                    <div className="create-grid-2">
                                        <label className="create-field">
                                            Start date
                                            <div className="create-input-wrap">
                                                <CalendarIcon />
                                                <input
                                                    name="startDate"
                                                    type="date"
                                                    min={today}
                                                    value={form.startDate}
                                                    onChange={handleChange}
                                                />
                                            </div>
                                        </label>
                                        <label className="create-field">
                                            End date
                                            <div className="create-input-wrap">
                                                <CalendarIcon />
                                                <input
                                                    name="endDate"
                                                    type="date"
                                                    min={form.startDate || today}
                                                    value={form.endDate}
                                                    onChange={handleChange}
                                                />
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                <div className="create-section">
                                    <div className="create-section-label">
                                        <span>Who can join *</span>
                                    </div>
                                    <div className="create-join" role="radiogroup" aria-label="Who can join">
                                        {JOIN_OPTIONS.map((opt) => (
                                            <button
                                                key={opt.id}
                                                type="button"
                                                role="radio"
                                                aria-checked={form.joinMode === opt.id}
                                                className={`create-join-opt ${form.joinMode === opt.id ? 'active' : ''}`}
                                                onClick={() => setJoinMode(opt.id)}
                                            >
                                                <span className="create-join-icon">{opt.icon}</span>
                                                <span className="create-join-text">
                                                    <strong>{opt.label}</strong>
                                                    <small>{opt.hint}</small>
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="create-grid-2">
                                    <label className="create-field">
                                        Max travelers
                                        <input
                                            name="maxParticipants"
                                            type="number"
                                            min="2"
                                            max="50"
                                            value={form.maxParticipants}
                                            onChange={handleChange}
                                        />
                                    </label>
                                    <label className="create-field">
                                        Budget / person (₹)
                                        <input
                                            name="budgetEstimate"
                                            type="number"
                                            min="0"
                                            placeholder="e.g. 8000"
                                            value={form.budgetEstimate}
                                            onChange={handleChange}
                                        />
                                    </label>
                                </div>

                                <div className="create-section">
                                    <div className="create-section-label">
                                        <span>Meeting point</span>
                                        <em>Optional</em>
                                    </div>
                                    <div className="create-map">
                                        <div className="create-map-art" aria-hidden="true">
                                            <svg viewBox="0 0 640 220" preserveAspectRatio="xMidYMid slice">
                                                <defs>
                                                    <pattern id="createDots" width="18" height="18" patternUnits="userSpaceOnUse">
                                                        <circle cx="1.5" cy="1.5" r="1.2" fill="rgba(38,198,218,0.35)" />
                                                    </pattern>
                                                </defs>
                                                <rect width="640" height="220" fill="url(#createDots)" />
                                                <path d="M40 140c40-50 90-70 140-40s90 20 140-20 100-10 140 30 90 40 140 10" fill="none" stroke="rgba(38,198,218,0.25)" strokeWidth="2" strokeDasharray="6 8" />
                                                <circle cx="180" cy="100" r="8" fill="#c45a66" opacity="0.9" />
                                                <circle cx="320" cy="80" r="6" fill="#a31d31" opacity="0.85" />
                                                <circle cx="460" cy="120" r="7" fill="#A3A3CC" opacity="0.75" />
                                            </svg>
                                        </div>
                                        <div className="create-map-body">
                                            <div className="create-map-pin" aria-hidden="true">
                                                <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
                                                    <path d="M12 21s7-5.3 7-11a7 7 0 10-14 0c0 5.7 7 11 7 11z" stroke="currentColor" strokeWidth="1.8" />
                                                    <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.8" />
                                                </svg>
                                            </div>
                                            <div className="create-map-copy">
                                                <strong>Select meeting points and landmarks</strong>
                                                <p>Tell joiners where the trip starts.</p>
                                            </div>
                                            <LocationAutocomplete
                                                name="meetingPoint"
                                                placeholder="e.g. Majestic Bus Stand, Bangalore"
                                                value={form.meetingPoint}
                                                onChange={(val) => updateForm({ meetingPoint: val })}
                                                onSelect={(loc) => updateForm((f) => ({
                                                    ...f,
                                                    meetingPoint: loc.label || f.meetingPoint,
                                                }))}
                                                className="create-map-autocomplete"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <p className="create-note">
                                    Budget is a guide for joiners. Exact shared costs are split later on the trip Expenses tab.
                                </p>

                                <TripCarSuggestions
                                    destination={form.destination}
                                    startDate={form.startDate}
                                    endDate={form.endDate}
                                    seats={Number(form.maxParticipants) || 4}
                                    title="Suggested cars for this trip"
                                    compact
                                />
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="create-step-body">
                            <div className="create-panel-head">
                                <h2>Ready to publish?</h2>
                                <p>Double-check the details. You can approve join requests after posting.</p>
                            </div>

                            <div className="create-review">
                                {form.coverImageUrl && (
                                    <div className="create-review-cover">
                                        <img src={form.coverImageUrl} alt="Selected cover" />
                                    </div>
                                )}
                                <div className="create-review-hero">
                                    <p className="create-review-dest">{form.destination || 'Destination'}</p>
                                    <h3 className="font-display">{form.title || 'Untitled trip'}</h3>
                                    {form.description && <p>{form.description}</p>}
                                </div>
                                <dl className="create-review-meta">
                                    <div>
                                        <dt>Dates</dt>
                                        <dd>{dateSummary || '—'}</dd>
                                    </div>
                                    <div>
                                        <dt>Group size</dt>
                                        <dd>Up to {form.maxParticipants}</dd>
                                    </div>
                                    <div>
                                        <dt>Budget / person</dt>
                                        <dd>{form.budgetEstimate ? `₹${Number(form.budgetEstimate).toLocaleString()}` : 'Not set'}</dd>
                                    </div>
                                    <div>
                                        <dt>Who can join</dt>
                                        <dd>{joinLabel}</dd>
                                    </div>
                                    {form.meetingPoint.trim() && (
                                        <div className="span-2">
                                            <dt>Meeting point</dt>
                                            <dd>{form.meetingPoint}</dd>
                                        </div>
                                    )}
                                </dl>
                            </div>

                            <TripCarSuggestions
                                destination={form.destination}
                                startDate={form.startDate}
                                endDate={form.endDate}
                                seats={Number(form.maxParticipants) || 4}
                                title="Need a car for this trip?"
                            />
                        </div>
                    )}

                    <div className="create-nav">
                        {step > 0 ? (
                            <button type="button" className="create-btn ghost" onClick={() => goToStep(step - 1)}>
                                Back
                            </button>
                        ) : (
                            <Link to="/trips" className="create-btn ghost">Cancel</Link>
                        )}

                        {step < STEPS.length - 1 ? (
                            <button type="button" className="create-btn primary" onClick={goNext} disabled={!canNext}>
                                Continue
                            </button>
                        ) : (
                            <button
                                type="button"
                                className="create-btn primary"
                                onClick={handleSubmit}
                                disabled={isLoading || !canNext}
                            >
                                {isLoading ? 'Publishing…' : 'Publish trip'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
