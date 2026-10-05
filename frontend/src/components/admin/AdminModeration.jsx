import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { adminApi } from '../../api/index.js';
import { mediaUrl } from '../../utils/mediaUrl.js';

function Modal({ title, onClose, children }) {
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    return (
        <div className="adm-drawer-backdrop adm-modal-backdrop" onClick={onClose} role="presentation">
            <div className="adm-modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
                <div className="adm-drawer-head">
                    <h2>{title}</h2>
                    <button type="button" className="adm-drawer-close" onClick={onClose} aria-label="Close">×</button>
                </div>
                <div className="adm-drawer-body">{children}</div>
            </div>
        </div>
    );
}

/** Read a trip's chat and announcements; delete abusive content. */
export function TripChatModeration({ tripId, onClose }) {
    const [data, setData] = useState(null);

    const load = useCallback(async () => {
        try {
            const res = await adminApi.getTripChat(tripId);
            setData(res.data.data);
        } catch {
            toast.error('Failed to load chat.');
            onClose();
        }
    }, [tripId, onClose]);

    useEffect(() => { load(); }, [load]);

    const remove = async (kind, item) => {
        const preview = kind === 'message' ? item.content : item.title;
        if (!window.confirm(`Delete this ${kind}?\n\n“${preview.slice(0, 160)}”\n\nThe text is kept in the audit log.`)) return;
        try {
            await (kind === 'message' ? adminApi.deleteMessage(item.id) : adminApi.deleteAnnouncement(item.id));
            toast.success(`${kind === 'message' ? 'Message' : 'Announcement'} deleted.`);
            load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Delete failed.');
        }
    };

    return (
        <Modal title={data ? `Moderate “${data.trip.title}”` : 'Moderate trip'} onClose={onClose}>
            {!data ? <p className="text-muted">Loading…</p> : (
                <>
                    <section className="adm-drawer-section">
                        <h3>Announcements ({data.announcements.length})</h3>
                        {data.announcements.length === 0 ? <p className="text-muted">None.</p> : (
                            <ul className="adm-drawer-list">
                                {data.announcements.map((a) => (
                                    <li key={a.id}>
                                        <span><strong>{a.title}</strong> <small>{a.author?.name} · {format(new Date(a.createdAt), 'd MMM')}</small><br />{a.content}</span>
                                        <button type="button" className="btn btn-danger btn-sm" onClick={() => remove('announcement', a)}>Delete</button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                    <section className="adm-drawer-section">
                        <h3>Latest chat ({data.messages.length})</h3>
                        {data.messages.length === 0 ? <p className="text-muted">No messages.</p> : (
                            <ul className="adm-drawer-list">
                                {data.messages.map((m) => (
                                    <li key={m.id}>
                                        <span><strong>{m.user?.name}</strong> <small>{format(new Date(m.createdAt), 'd MMM, HH:mm')}</small><br />{m.content}</span>
                                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove('message', m)}>Delete</button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </>
            )}
        </Modal>
    );
}

/** Edit a listing's price/location/description and remove bad photos. */
export function ListingEditor({ listing, onClose, onSaved }) {
    const [form, setForm] = useState({
        pricePerDay: String(listing.pricePerDay),
        location: listing.location || '',
        description: listing.description || '',
    });
    const [images, setImages] = useState(listing.vehicle?.images || []);
    const [saving, setSaving] = useState(false);

    const save = async (e) => {
        e.preventDefault();
        const changes = {};
        if (Number(form.pricePerDay) !== listing.pricePerDay) changes.pricePerDay = Number(form.pricePerDay);
        if (form.location.trim() !== (listing.location || '')) changes.location = form.location.trim();
        if (form.description.trim() !== (listing.description || '')) changes.description = form.description.trim();
        const photosChanged = images.length !== (listing.vehicle?.images || []).length;
        if (!Object.keys(changes).length && !photosChanged) return onClose();

        setSaving(true);
        try {
            if (Object.keys(changes).length) await adminApi.editListing(listing.id, changes);
            if (photosChanged) await adminApi.setVehicleImages(listing.vehicle.id, images);
            toast.success('Listing updated. The host has been notified.');
            onSaved();
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Save failed.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal title={`Edit ${listing.vehicle?.make} ${listing.vehicle?.model}`} onClose={onClose}>
            <form className="adm-edit-form" onSubmit={save}>
                <label>
                    <span>Price per day (₹)</span>
                    <input className="form-input" type="number" min="1" value={form.pricePerDay} onChange={(e) => setForm({ ...form, pricePerDay: e.target.value })} />
                </label>
                <label>
                    <span>Location</span>
                    <input className="form-input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                </label>
                <label>
                    <span>Description</span>
                    <textarea className="form-input" rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </label>
                <div>
                    <span className="adm-edit-label">Photos (click × to remove)</span>
                    {images.length === 0 ? <p className="text-muted">No photos.</p> : (
                        <div className="adm-edit-photos">
                            {images.map((url) => (
                                <div key={url} className="adm-edit-photo">
                                    <img src={mediaUrl(url)} alt="Vehicle" />
                                    <button type="button" aria-label="Remove photo" onClick={() => setImages((list) => list.filter((u) => u !== url))}>×</button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="admin-actions">
                    <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save & notify host'}</button>
                    <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                </div>
            </form>
        </Modal>
    );
}
