import { useState } from 'react';
import { exploreApi } from '../api/index.js';
import AiContactFields, { initialAiContact } from './AiContactFields.jsx';
import './TripAiDraft.css';

const questions = [
    { key: 'destination', label: 'Where are you taking the group?', placeholder: 'e.g. Rishikesh', max: 120, required: true },
    { key: 'style', label: 'What kind of trip are you planning?', placeholder: 'e.g. a relaxed weekend by the Ganges', max: 120, required: true },
    { key: 'pickup', label: 'Where will the group meet?', placeholder: 'e.g. Kashmiri Gate ISBT', max: 120 },
    { key: 'stopovers', label: 'Which places will you stop at?', placeholder: 'One stop per line, up to eight', max: 970, multiline: true },
    { key: 'budget', label: 'What is the estimated budget per person?', placeholder: 'Amount in ₹', number: true },
    { key: 'notes', label: 'What else should travellers know?', placeholder: 'e.g. bring walking shoes and a light jacket', max: 400, multiline: true },
];

export default function TripAiDraft({ form, user, onApply, onClose }) {
    const [contact, setContact] = useState(() => initialAiContact(user));
    const [answers, setAnswers] = useState({
        destination: form.destination, pickup: form.meetingPoint, stopovers: form.stopovers,
        budget: form.budgetEstimate ?? '', style: '', notes: '',
    });
    const [step, setStep] = useState(0);
    const [draft, setDraft] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [quota, setQuota] = useState(null);
    const question = questions[step - 1];
    const lastStep = step === questions.length;
    const goBack = () => { setError(''); setStep((current) => current - 1); };

    const submit = async (event) => {
        event.preventDefault();
        setError('');
        if (question?.required && !answers[question.key].trim()) {
            setError('Please fill in this answer.');
            return;
        }
        if (!lastStep) {
            setStep(step + 1);
            return;
        }
        setBusy(true);
        try {
            const { data } = await exploreApi.draftTrip({
                contact, answers: { ...answers, stopovers: answers.stopovers.split('\n') },
            });
            setDraft(data.data.draft);
            setQuota(data.data.quota);
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Could not generate your draft. Try again.');
        } finally {
            setBusy(false);
        }
    };

    const update = (event) => setAnswers({ ...answers, [question.key]: event.target.value });

    return (
        <section className="trip-ai-draft" aria-label="AI trip description">
            <div className="trip-ai-draft-head">
                <h3>Draft your trip with AI</h3>
                <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>Close</button>
            </div>
            {draft ? (
                <div className="trip-ai-preview">
                    <h4>{draft.title}</h4>
                    <p>{draft.description}</p>
                    {draft.pickup && <div><strong>Pickup</strong> · {draft.pickup}</div>}
                    {draft.stopovers.length > 0 && <div><strong>Stopovers</strong> · {draft.stopovers.join(', ')}</div>}
                    {draft.budget !== null && <div><strong>Budget per person</strong> · ₹{draft.budget.toLocaleString('en-IN')}</div>}
                    <p className="ai-remaining" role="status">
                        {draft.source === 'template' && 'Your draft was built from your answers using a template. '}
                        {quota.remaining} of {quota.limit} AI messages left today.
                    </p>
                    <div className="trip-ai-actions">
                        <button type="button" className="btn btn-ghost" onClick={() => setDraft(null)}>Edit answers</button>
                        <button type="button" className="btn btn-primary" onClick={() => onApply(draft)}>Use this draft</button>
                    </div>
                </div>
            ) : (
                <form onSubmit={submit}>
                    <p className="ai-remaining">Step {step + 1} of {questions.length + 1} · One AI message per draft</p>
                    {step === 0 ? (
                        <AiContactFields contact={contact} onChange={setContact} disabled={busy} />
                    ) : (
                        <label className="create-field">
                            {question.label} {!question.required && <small>Optional</small>}
                            {question.multiline ? (
                                <textarea key={question.key} rows={3} maxLength={question.max} placeholder={question.placeholder}
                                    value={answers[question.key]} onChange={update} disabled={busy} />
                            ) : (
                                <input key={question.key} type={question.number ? 'number' : 'text'}
                                    min={question.number ? 0 : undefined} max={question.number ? 10000000 : undefined}
                                    placeholder={question.placeholder} maxLength={question.max}
                                    value={answers[question.key]} onChange={update} required={question.required} disabled={busy} />
                            )}
                        </label>
                    )}
                    {error && <p role="alert">{error}</p>}
                    <div className="trip-ai-actions">
                        {step > 0 && <button type="button" className="btn btn-ghost" onClick={goBack} disabled={busy}>Back</button>}
                        <button type="submit" className="btn btn-primary" disabled={busy}>
                            {busy ? 'Drafting…' : lastStep ? 'Generate draft' : 'Continue'}
                        </button>
                    </div>
                </form>
            )}
        </section>
    );
}
