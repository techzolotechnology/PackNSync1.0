import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { tripsApi } from '../api/index.js';
import toast from 'react-hot-toast';
import './CreateTripPage.css';

const STEPS = [
    { id: 'details', label: 'Details', hint: 'Where & what' },
    { id: 'dates', label: 'Plan', hint: 'When & who' },
    { id: 'review', label: 'Publish', hint: 'Confirm' },
];

const today = new Date().toISOString().slice(0, 10);

export default function CreateTripPage() {
    const navigate = useNavigate();
    const [step, setStep] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [form, setForm] = useState({
        title: '',
        description: '',
        destination: '',
        startDate: '',
        endDate: '',
        maxParticipants: 6,
        budgetEstimate: '',
        isPublic: true,
    });

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
    };

    const canNext = useMemo(() => {
        if (step === 0) return Boolean(form.title.trim() && form.destination.trim());
        if (step === 1) {
            return Boolean(form.startDate && form.endDate && form.endDate >= form.startDate);
        }
        return true;
    }, [step, form]);

    const goNext = () => {
        if (!canNext) {
            if (step === 0) toast.error('Add a trip title and destination.');
            if (step === 1) toast.error('Choose valid start and end dates.');
            return;
        }
        setStep((s) => Math.min(s + 1, STEPS.length - 1));
    };

    const handleSubmit = async () => {
        if (!form.startDate || !form.endDate) {
            toast.error('Dates are required.');
            return;
        }
        setIsLoading(true);
        try {
            const res = await tripsApi.create({
                ...form,
                title: form.title.trim(),
                destination: form.destination.trim(),
                maxParticipants: Number(form.maxParticipants) || 6,
                budgetEstimate: form.budgetEstimate ? Number(form.budgetEstimate) : null,
            });
            toast.success('Trip posted — others can join and split costs.');
            navigate(`/trips/${res.data.data.id}`);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to create trip.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="create-trip-page page-enter">
            <div className="create-glow" aria-hidden="true" />
            <div className="create-shell">
                <header className="create-hero">
                    <p className="create-kicker">Travel Together</p>
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
                            onClick={() => i < step && setStep(i)}
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
                                    <input
                                        name="destination"
                                        type="text"
                                        placeholder="Coorg, Karnataka"
                                        value={form.destination}
                                        onChange={handleChange}
                                    />
                                </label>
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

                                <div className="create-visibility">
                                    <span>Who can find this trip?</span>
                                    <div className="create-toggle">
                                        <button
                                            type="button"
                                            className={form.isPublic ? 'active' : ''}
                                            onClick={() => setForm((f) => ({ ...f, isPublic: true }))}
                                        >
                                            Public
                                        </button>
                                        <button
                                            type="button"
                                            className={!form.isPublic ? 'active' : ''}
                                            onClick={() => setForm((f) => ({ ...f, isPublic: false }))}
                                        >
                                            Private
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 1 && (
                        <div className="create-step-body">
                            <div className="create-panel-head">
                                <h2>Dates & group size</h2>
                                <p>Set when you’re going and how many seats are open.</p>
                            </div>

                            <div className="create-fields">
                                <div className="create-grid-2">
                                    <label className="create-field">
                                        Start date *
                                        <input
                                            name="startDate"
                                            type="date"
                                            min={today}
                                            value={form.startDate}
                                            onChange={handleChange}
                                        />
                                    </label>
                                    <label className="create-field">
                                        End date *
                                        <input
                                            name="endDate"
                                            type="date"
                                            min={form.startDate || today}
                                            value={form.endDate}
                                            onChange={handleChange}
                                        />
                                    </label>
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
                                        Budget per person (₹)
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
                                <p className="create-note">
                                    Budget is a guide for joiners. Exact shared costs are split later on the trip Expenses tab.
                                </p>
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
                                <div className="create-review-hero">
                                    <p className="create-review-dest">{form.destination || 'Destination'}</p>
                                    <h3 className="font-display">{form.title || 'Untitled trip'}</h3>
                                    {form.description && <p>{form.description}</p>}
                                </div>
                                <dl className="create-review-meta">
                                    <div>
                                        <dt>Dates</dt>
                                        <dd>
                                            {form.startDate && form.endDate
                                                ? `${form.startDate} → ${form.endDate}`
                                                : '—'}
                                        </dd>
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
                                        <dt>Visibility</dt>
                                        <dd>{form.isPublic ? 'Public — anyone can request to join' : 'Private'}</dd>
                                    </div>
                                </dl>
                            </div>
                        </div>
                    )}

                    <div className="create-nav">
                        {step > 0 ? (
                            <button type="button" className="btn btn-ghost" onClick={() => setStep((s) => s - 1)}>
                                Back
                            </button>
                        ) : (
                            <Link to="/trips" className="btn btn-ghost">Cancel</Link>
                        )}

                        {step < STEPS.length - 1 ? (
                            <button type="button" className="btn btn-primary" onClick={goNext} disabled={!canNext}>
                                Continue
                            </button>
                        ) : (
                            <button
                                type="button"
                                className="btn btn-primary"
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
