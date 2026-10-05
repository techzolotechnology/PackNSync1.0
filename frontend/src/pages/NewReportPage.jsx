import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { reportsApi } from '../api/index.js';
import { REPORT_CATEGORY_HINTS } from './reportLabels.js';
import './Reports.css';

const MAX_PHOTOS = 4;

/** /reports/new — file a report or dispute. Prefilled from ?bookingId= / ?targetType=&targetId= */
export default function NewReportPage() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const presetTargetType = String(params.get('targetType') || '').toUpperCase();
    const presetTargetId = params.get('targetId') || '';

    const [options, setOptions] = useState(null);
    const [category, setCategory] = useState(String(params.get('category') || '').toUpperCase());
    const [about, setAbout] = useState(params.get('bookingId') ? `booking:${params.get('bookingId')}` : params.get('tripId') ? `trip:${params.get('tripId')}` : '');
    const [subject, setSubject] = useState('');
    const [description, setDescription] = useState('');
    const [photos, setPhotos] = useState([]); // { url, preview }
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        reportsApi.options()
            .then((res) => setOptions(res.data.data))
            .catch(() => toast.error('Could not load the report form. Please try again.'));
    }, []);

    // Free preview blobs when leaving the page (removed photos are freed on remove).
    const photosRef = useRef(photos);
    photosRef.current = photos;
    useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.preview)), []);

    const removePhoto = (url) => {
        setPhotos((list) => {
            const gone = list.find((x) => x.url === url);
            if (gone) URL.revokeObjectURL(gone.preview);
            return list.filter((x) => x.url !== url);
        });
    };

    const fixedTarget = ['USER', 'LISTING', 'TRIP'].includes(presetTargetType) && presetTargetId;
    const descriptionLeft = Math.max(0, 20 - description.trim().length);

    const aboutChoices = useMemo(() => {
        if (!options) return [];
        return [
            ...options.bookings.map((b) => ({
                value: `booking:${b.id}`,
                label: `${b.role === 'host' ? 'Hosting' : 'Rental'}: ${b.label} · ${new Date(b.startDate).toLocaleDateString('en-IN')}`,
            })),
            ...options.trips.map((t) => ({ value: `trip:${t.id}`, label: `Trip: ${t.title} (${t.destination})` })),
        ];
    }, [options]);

    const addPhotos = async (fileList) => {
        const files = [...fileList].slice(0, MAX_PHOTOS - photos.length);
        if (!files.length) return;
        setUploading(true);
        try {
            for (const file of files) {
                const res = await reportsApi.uploadEvidence(file);
                setPhotos((list) => [...list, { url: res.data.data.url, preview: URL.createObjectURL(file) }]);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Photo upload failed.');
        } finally {
            setUploading(false);
        }
    };

    const submit = async (e) => {
        e.preventDefault();
        if (!category) return toast.error('Choose what kind of problem this is.');
        if (subject.trim().length < 5) return toast.error('Add a short title.');
        if (descriptionLeft > 0) return toast.error('Describe what happened in a bit more detail.');

        const [kind, id] = about.split(':');
        const body = {
            category,
            subject: subject.trim(),
            description: description.trim(),
            evidence: photos.map((p) => p.url),
            ...(fixedTarget ? { targetType: presetTargetType, targetId: presetTargetId } : {}),
            ...(kind === 'booking' ? { bookingId: id } : {}),
            ...(kind === 'trip' && !fixedTarget ? { targetType: 'TRIP', targetId: id } : {}),
        };
        setSubmitting(true);
        try {
            const res = await reportsApi.create(body);
            toast.success(res.data.earningHeld
                ? 'Report sent. We have paused the host payout for this booking while we review.'
                : 'Report sent. Our team will reply here.');
            navigate(`/reports/${res.data.data.id}`);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not send the report.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="rpt-page page-enter">
            <div className="container rpt-narrow">
                <nav className="rpt-crumbs"><Link to="/reports">Reports &amp; disputes</Link> / New report</nav>
                <h1>Report a problem</h1>
                <p className="rpt-lead">
                    Tell us what went wrong with a trip, booking, host or traveller. Reports are private — only you and the
                    PickAndSync team can see them.
                </p>

                {category === 'SAFETY' && (
                    <div className="rpt-emergency" role="alert">
                        <strong>In immediate danger?</strong> Call <a href="tel:112">112</a> (India emergency) first, then file this report.
                    </div>
                )}

                <form className="rpt-form" onSubmit={submit}>
                    <fieldset>
                        <legend>What kind of problem is it?</legend>
                        <div className="rpt-categories">
                            {(options?.categories || []).map((c) => (
                                <label key={c.id} className={`rpt-category ${category === c.id ? 'is-selected' : ''}`}>
                                    <input type="radio" name="category" value={c.id} checked={category === c.id} onChange={() => setCategory(c.id)} />
                                    <strong>{c.label}</strong>
                                    <span>{REPORT_CATEGORY_HINTS[c.id]}</span>
                                </label>
                            ))}
                        </div>
                    </fieldset>

                    {fixedTarget ? (
                        <p className="rpt-fixed-target">
                            Reporting a {presetTargetType.toLowerCase()} you came from.
                        </p>
                    ) : (
                        <label className="rpt-field">
                            <span>What is it about? <em>(optional)</em></span>
                            <select className="form-input" value={about} onChange={(e) => setAbout(e.target.value)}>
                                <option value="">Not about a specific booking or trip</option>
                                {aboutChoices.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                            </select>
                        </label>
                    )}

                    <label className="rpt-field">
                        <span>Title</span>
                        <input
                            className="form-input"
                            maxLength={120}
                            placeholder="e.g. Car had a flat tyre at pickup"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                        />
                    </label>

                    <label className="rpt-field">
                        <span>What happened?</span>
                        <textarea
                            className="form-input"
                            rows={6}
                            maxLength={4000}
                            placeholder="Include dates, times, what was said or agreed, and what you would like us to do."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                        {descriptionLeft > 0 && <small>{descriptionLeft} more characters needed</small>}
                    </label>

                    <div className="rpt-field">
                        <span>Photos <em>(optional, up to {MAX_PHOTOS})</em></span>
                        <div className="rpt-photos">
                            {photos.map((p) => (
                                <div key={p.url} className="rpt-photo">
                                    <img src={p.preview} alt="Evidence" />
                                    <button type="button" aria-label="Remove photo" onClick={() => removePhoto(p.url)}>×</button>
                                </div>
                            ))}
                            {photos.length < MAX_PHOTOS && (
                                <label className="rpt-photo-add">
                                    <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} />
                                    {uploading ? 'Uploading…' : '+ Add photo'}
                                </label>
                            )}
                        </div>
                    </div>

                    <button type="submit" className="btn btn-primary" disabled={submitting || uploading}>
                        {submitting ? 'Sending…' : 'Send report'}
                    </button>
                </form>
            </div>
        </div>
    );
}
