import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { usersApi } from '../api/index.js';
import { useAuthStore } from '../store/authStore.js';
import './ProfilePage.css';

const TRIP_FALLBACK =
    'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=800&q=70';

const INTEREST_OPTIONS = [
    'Road trips', 'Beach', 'Mountains', 'Food', 'Photography',
    'Nightlife', 'Adventure', 'Culture', 'Camping', 'City breaks',
];

const LANGUAGE_OPTIONS = ['English', 'Hindi', 'Kannada', 'Tamil', 'Telugu', 'Marathi', 'Bengali', 'Malayalam'];

const TRAVEL_STYLES = [
    { value: '', label: 'Select style' },
    { value: 'budget', label: 'Budget' },
    { value: 'balanced', label: 'Balanced' },
    { value: 'comfort', label: 'Comfort' },
    { value: 'adventure', label: 'Adventure' },
];

const emptyForm = {
    name: '',
    bio: '',
    city: '',
    languages: [],
    interests: [],
    emergencyContact: '',
    drivingYears: '',
    travelStyle: '',
};

const toForm = (data = {}) => ({
    name: data.name || '',
    bio: data.bio || '',
    city: data.city || '',
    languages: data.languages || [],
    interests: data.interests || [],
    emergencyContact: data.emergencyContact || '',
    drivingYears: data.drivingYears ?? '',
    travelStyle: data.travelStyle || '',
});

function toggleItem(list, item) {
    return list.includes(item) ? list.filter((x) => x !== item) : [...list, item].slice(0, 12);
}

export default function ProfilePage() {
    const { id } = useParams();
    const { user: currentUser, setUser } = useAuthStore();
    const syncAuthUser = (patch) => {
        const token = useAuthStore.getState().accessToken || localStorage.getItem('access_token');
        setUser({ ...currentUser, ...patch }, token);
    };
    const fileRef = useRef(null);
    const [profile, setProfile] = useState(null);
    const [trips, setTrips] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [editForm, setEditForm] = useState(emptyForm);
    const [isSaving, setIsSaving] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

    const isOwn = currentUser?.id === id;

    useEffect(() => {
        setIsLoading(true);
        (async () => {
            try {
                const [profileRes, tripsRes] = await Promise.all([
                    usersApi.getById(id),
                    usersApi.getTrips(id),
                ]);
                const data = profileRes.data.data;
                setProfile(data);
                setTrips(tripsRes.data.data || []);
                setEditForm(toForm(data));
                setEditing(false);
            } catch {
                setProfile(null);
            } finally {
                setIsLoading(false);
            }
        })();
    }, [id]);

    const handleSave = async () => {
        if (!editForm.name.trim()) {
            toast.error('Name is required.');
            return;
        }
        setIsSaving(true);
        try {
            const res = await usersApi.update(id, {
                name: editForm.name.trim(),
                bio: editForm.bio.trim(),
                city: editForm.city.trim(),
                languages: editForm.languages,
                interests: editForm.interests,
                emergencyContact: editForm.emergencyContact.trim(),
                drivingYears: editForm.drivingYears === '' ? null : Number(editForm.drivingYears),
                travelStyle: editForm.travelStyle,
            });
            setProfile((p) => ({ ...p, ...res.data.data }));
            if (isOwn) syncAuthUser(res.data.data);
            setEditing(false);
            toast.success('Profile updated');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update profile.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleAvatar = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingAvatar(true);
        try {
            const res = await usersApi.uploadAvatar(file);
            setProfile((p) => ({ ...p, ...res.data.data }));
            if (isOwn) syncAuthUser(res.data.data);
            toast.success('Photo updated');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Photo upload failed.');
        } finally {
            setUploadingAvatar(false);
            e.target.value = '';
        }
    };

    if (isLoading) {
        return (
            <div className="pf-page">
                <div className="container pf-inner">
                    <div className="pf-card pf-skeleton">
                        <div className="pf-skel-avatar" />
                        <div className="pf-skel-lines">
                            <div className="pf-skel-line w40" />
                            <div className="pf-skel-line w70" />
                            <div className="pf-skel-line w55" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="pf-page">
                <div className="container pf-inner">
                    <div className="pf-empty">
                        <h2>User not found</h2>
                        <p>This profile may have been removed.</p>
                        <Link to="/trips" className="pf-btn primary">Browse trips</Link>
                    </div>
                </div>
            </div>
        );
    }

    const initial = (profile.name || '?')[0].toUpperCase();
    const joined = profile.createdAt
        ? format(new Date(profile.createdAt), 'MMMM yyyy')
        : null;
    const styleLabel = TRAVEL_STYLES.find((s) => s.value === profile.travelStyle)?.label;

    return (
        <div className="pf-page">
            <div className="container pf-inner">
                <section className={`pf-card ${editing ? 'editing' : ''}`}>
                    <div className="pf-avatar-col">
                        <div className="pf-avatar">
                            {profile.avatarUrl ? (
                                <img src={profile.avatarUrl} alt={profile.name} />
                            ) : (
                                <span>{initial}</span>
                            )}
                            {isOwn && (
                                <button
                                    type="button"
                                    className="pf-avatar-edit"
                                    disabled={uploadingAvatar}
                                    onClick={() => fileRef.current?.click()}
                                    aria-label="Change photo"
                                >
                                    {uploadingAvatar ? '…' : (
                                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
                                            <path d="M4 17.5V19a1 1 0 001 1h1.5M15.5 5.5l3 3M7 17l9.2-9.2a1.5 1.5 0 012.1 0l1 1a1.5 1.5 0 010 2.1L10 20H7v-3z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    )}
                                </button>
                            )}
                        </div>
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            hidden
                            onChange={handleAvatar}
                        />
                    </div>

                    <div className="pf-body">
                        {editing ? (
                            <div className="pf-edit">
                                <div className="pf-edit-grid">
                                    <label>
                                        Display name
                                        <input
                                            value={editForm.name}
                                            onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                                            maxLength={60}
                                            autoFocus
                                        />
                                    </label>
                                    <label>
                                        City
                                        <input
                                            value={editForm.city}
                                            onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))}
                                            placeholder="e.g. Bangalore"
                                            maxLength={80}
                                        />
                                    </label>
                                </div>

                                <label>
                                    Bio
                                    <textarea
                                        rows={3}
                                        value={editForm.bio}
                                        onChange={(e) => setEditForm((f) => ({ ...f, bio: e.target.value }))}
                                        placeholder="Tell travelers and renters a bit about you"
                                        maxLength={280}
                                    />
                                </label>

                                <div className="pf-edit-grid">
                                    <label>
                                        Travel style
                                        <select
                                            value={editForm.travelStyle}
                                            onChange={(e) => setEditForm((f) => ({ ...f, travelStyle: e.target.value }))}
                                        >
                                            {TRAVEL_STYLES.map((s) => (
                                                <option key={s.value || 'none'} value={s.value}>{s.label}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label>
                                        Years of driving
                                        <input
                                            type="number"
                                            min="0"
                                            max="70"
                                            value={editForm.drivingYears}
                                            onChange={(e) => setEditForm((f) => ({ ...f, drivingYears: e.target.value }))}
                                            placeholder="e.g. 5"
                                        />
                                    </label>
                                </div>

                                <fieldset className="pf-chip-field">
                                    <legend>Languages</legend>
                                    <div className="pf-chips">
                                        {LANGUAGE_OPTIONS.map((lang) => (
                                            <button
                                                key={lang}
                                                type="button"
                                                className={editForm.languages.includes(lang) ? 'on' : ''}
                                                onClick={() => setEditForm((f) => ({
                                                    ...f,
                                                    languages: toggleItem(f.languages, lang),
                                                }))}
                                            >
                                                {lang}
                                            </button>
                                        ))}
                                    </div>
                                </fieldset>

                                <fieldset className="pf-chip-field">
                                    <legend>Interests</legend>
                                    <div className="pf-chips">
                                        {INTEREST_OPTIONS.map((item) => (
                                            <button
                                                key={item}
                                                type="button"
                                                className={editForm.interests.includes(item) ? 'on' : ''}
                                                onClick={() => setEditForm((f) => ({
                                                    ...f,
                                                    interests: toggleItem(f.interests, item),
                                                }))}
                                            >
                                                {item}
                                            </button>
                                        ))}
                                    </div>
                                </fieldset>

                                <label>
                                    Emergency contact <span className="pf-private">(only visible to you)</span>
                                    <input
                                        value={editForm.emergencyContact}
                                        onChange={(e) => setEditForm((f) => ({ ...f, emergencyContact: e.target.value }))}
                                        placeholder="Name + phone number"
                                        maxLength={80}
                                    />
                                </label>

                                <div className="pf-edit-actions">
                                    <button type="button" className="pf-btn primary" onClick={handleSave} disabled={isSaving}>
                                        {isSaving ? 'Saving…' : 'Save'}
                                    </button>
                                    <button
                                        type="button"
                                        className="pf-btn ghost"
                                        onClick={() => {
                                            setEditing(false);
                                            setEditForm(toForm(profile));
                                        }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="pf-title-row">
                                    <h1>{profile.name}</h1>
                                    <div className="pf-badges">
                                        {profile.isVerified && (
                                            <span className="pf-badge verified">Verified</span>
                                        )}
                                        <span className={`pf-badge role ${profile.role?.toLowerCase()}`}>
                                            {profile.role === 'ADMIN' ? 'Admin' : 'Member'}
                                        </span>
                                    </div>
                                </div>

                                <p className="pf-bio">
                                    {profile.bio || (isOwn
                                        ? 'Add a short bio so hosts and trip mates know who you are.'
                                        : 'This traveler hasn’t added a bio yet.')}
                                </p>

                                <div className="pf-details">
                                    {profile.city && (
                                        <div className="pf-detail">
                                            <span>City</span>
                                            <strong>{profile.city}</strong>
                                        </div>
                                    )}
                                    {styleLabel && (
                                        <div className="pf-detail">
                                            <span>Travel style</span>
                                            <strong>{styleLabel}</strong>
                                        </div>
                                    )}
                                    {profile.drivingYears != null && (
                                        <div className="pf-detail">
                                            <span>Driving</span>
                                            <strong>{profile.drivingYears} yrs</strong>
                                        </div>
                                    )}
                                    {joined && (
                                        <div className="pf-detail">
                                            <span>Joined</span>
                                            <strong>{joined}</strong>
                                        </div>
                                    )}
                                </div>

                                {(profile.languages?.length > 0 || profile.interests?.length > 0) && (
                                    <div className="pf-tags-wrap">
                                        {profile.languages?.length > 0 && (
                                            <div className="pf-tag-row">
                                                <span className="pf-tag-label">Languages</span>
                                                <div className="pf-tags">
                                                    {profile.languages.map((lang) => (
                                                        <span key={lang}>{lang}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {profile.interests?.length > 0 && (
                                            <div className="pf-tag-row">
                                                <span className="pf-tag-label">Interests</span>
                                                <div className="pf-tags">
                                                    {profile.interests.map((item) => (
                                                        <span key={item}>{item}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="pf-meta">
                                    {isOwn && profile.email && <span>{profile.email}</span>}
                                    {isOwn && profile.phoneNumber && <span>{profile.phoneNumber}</span>}
                                    {isOwn && profile.emergencyContact && (
                                        <span>Emergency: {profile.emergencyContact}</span>
                                    )}
                                </div>

                                {isOwn && (
                                    <div className="pf-actions">
                                        <button type="button" className="pf-btn primary" onClick={() => setEditing(true)}>
                                            Edit profile
                                        </button>
                                        {!profile.isVerified && (
                                            <Link to="/verify" className="pf-btn ghost">Verify ID</Link>
                                        )}
                                        <Link to="/host" className="pf-btn ghost">Host a vehicle</Link>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </section>

                <div className="pf-stats">
                    <div className="pf-stat">
                        <strong>{profile.stats?.trips ?? trips.length}</strong>
                        <span>Trips</span>
                    </div>
                    <div className="pf-stat">
                        <strong>{profile.stats?.vehicles ?? 0}</strong>
                        <span>Vehicles</span>
                    </div>
                    <div className="pf-stat">
                        <strong>{profile.stats?.listings ?? 0}</strong>
                        <span>Listings</span>
                    </div>
                </div>

                <section className="pf-trips">
                    <div className="pf-section-head">
                        <h2>Trips <em>({trips.length})</em></h2>
                        {isOwn && (
                            <Link to="/trips/create" className="pf-link">+ New trip</Link>
                        )}
                    </div>

                    {trips.length === 0 ? (
                        <div className="pf-empty soft">
                            <h3>No trips yet</h3>
                            <p>{isOwn ? 'Post a trip and invite others to travel together.' : 'This member hasn’t joined any trips.'}</p>
                            {isOwn && <Link to="/trips/create" className="pf-btn primary">Create a trip</Link>}
                        </div>
                    ) : (
                        <div className="pf-trip-grid">
                            {trips.map((trip) => (
                                <Link key={trip.id} to={`/trips/${trip.id}`} className="pf-trip-card">
                                    <div className="pf-trip-media">
                                        <img
                                            src={trip.coverImageUrl || TRIP_FALLBACK}
                                            alt=""
                                            loading="lazy"
                                        />
                                    </div>
                                    <div className="pf-trip-info">
                                        <strong>{trip.title}</strong>
                                        <span>{trip.destination}</span>
                                        {trip.startDate && (
                                            <span className="pf-trip-date">
                                                {format(new Date(trip.startDate), 'MMM d, yyyy')}
                                            </span>
                                        )}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
