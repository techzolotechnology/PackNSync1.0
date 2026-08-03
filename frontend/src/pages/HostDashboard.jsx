import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { rentalsApi, vehiclesApi, verificationsApi } from '../api/index.js';
import TermsAcceptanceModal from '../components/TermsAcceptanceModal.jsx';
import './HostDashboard.css';

const today = new Date().toISOString().slice(0, 10);
const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

const FALLBACK_THUMB =
    'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=400&q=70';
const FALLBACK_BIKE_THUMB =
    'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=400&q=70';

const VEHICLE_TYPES = [
    { id: 'CAR', label: 'Car', makeHint: 'Toyota', modelHint: 'Innova', seats: 5 },
    { id: 'BIKE', label: 'Bike', makeHint: 'Royal Enfield', modelHint: 'Classic 350', seats: 2 },
    { id: 'SCOOTER', label: 'Scooter', makeHint: 'Honda', modelHint: 'Activa 6G', seats: 2 },
];

const initialVehicleForm = {
    make: '',
    model: '',
    year: 2024,
    type: 'CAR',
    licensePlate: '',
    seats: 5,
    fuelType: 'Petrol',
    transmission: 'Automatic',
};

function isTwoWheeler(type) {
    return type === 'BIKE' || type === 'SCOOTER';
}

function typeLabel(type) {
    return VEHICLE_TYPES.find((t) => t.id === type)?.label || type || 'Car';
}

const initialListingForm = {
    vehicleId: '',
    pricePerDay: 2000,
    location: 'Bangalore',
    description: '',
    availableFrom: today,
    availableTo: nextMonth,
};

function formatPrice(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    return `₹${n.toLocaleString('en-IN')} per day`;
}

export default function HostDashboard() {
    const navigate = useNavigate();
    const [tab, setTab] = useState('vehicles');
    const [vehicles, setVehicles] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [kycStatus, setKycStatus] = useState(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [showListingForm, setShowListingForm] = useState(false);
    const [termsModal, setTermsModal] = useState({ open: false, policyType: null, action: null });
    const [termsLoading, setTermsLoading] = useState(false);
    const [formData, setFormData] = useState(initialVehicleForm);
    const [vehicleImages, setVehicleImages] = useState([]);
    const [rcFile, setRcFile] = useState(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [savingVehicle, setSavingVehicle] = useState(false);
    const [rcUploadTarget, setRcUploadTarget] = useState(null);
    const [listingForm, setListingForm] = useState(initialListingForm);
    const [message, setMessage] = useState('');

    useEffect(() => {
        fetchDashboard();
        verificationsApi.getStatus().then((res) => setKycStatus(res.data.data)).catch(() => {});
    }, []);

    const fetchDashboard = async () => {
        setMessage('');
        try {
            const [vehiclesRes, bookingsRes] = await Promise.all([
                vehiclesApi.getMine(),
                rentalsApi.getHostBookings(),
            ]);
            setVehicles(vehiclesRes.data.data || []);
            setBookings(bookingsRes.data.data || []);
        } catch (err) {
            setMessage(err.response?.data?.message || 'Unable to load host dashboard.');
        }
    };

    const upcomingBookings = useMemo(
        () => bookings.filter((b) => ['PENDING', 'CONFIRMED', 'ACTIVE'].includes(b.status)),
        [bookings],
    );

    const requireListingCompliance = async (action) => {
        if (!kycStatus?.isFullyVerified) {
            toast.error('Complete KYC and wait for admin approval.');
            navigate('/verify');
            return;
        }
        const policyRes = await verificationsApi.getPolicyStatus();
        if (!policyRes.data.data?.status?.LISTING_TERMS) {
            setTermsModal({ open: true, policyType: 'LISTING_TERMS', action });
            return;
        }
        await action();
    };

    const handleTermsAccept = async () => {
        setTermsLoading(true);
        try {
            await verificationsApi.acceptPolicy(termsModal.policyType);
            setTermsModal({ open: false, policyType: null, action: null });
            if (termsModal.action) await termsModal.action();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not save acceptance.');
        } finally {
            setTermsLoading(false);
        }
    };

    const setVehicleType = (type) => {
        const preset = VEHICLE_TYPES.find((t) => t.id === type);
        setFormData((f) => ({
            ...f,
            type,
            seats: preset?.seats ?? f.seats,
            transmission: isTwoWheeler(type)
                ? (f.transmission === 'Diesel' ? 'Automatic' : f.transmission === 'Manual' ? 'Manual' : f.transmission)
                : f.transmission,
            fuelType: isTwoWheeler(type) && f.fuelType === 'Diesel' ? 'Petrol' : f.fuelType,
        }));
    };

    const resetAddForm = () => {
        setShowAddForm(false);
        setFormData(initialVehicleForm);
        setVehicleImages([]);
        setRcFile(null);
    };

    const handleAddVehicle = async (e) => {
        e.preventDefault();
        if (!rcFile) {
            toast.error('Upload a clear photo of the vehicle RC.');
            return;
        }
        await requireListingCompliance(async () => {
            setMessage('');
            setSavingVehicle(true);
            try {
                const plate = String(formData.licensePlate || '').trim().toUpperCase();
                await vehiclesApi.create({ ...formData, licensePlate: plate, images: vehicleImages });
                const rcRes = await verificationsApi.uploadRcOcr(plate, rcFile);
                toast.success(rcRes.data.message || 'Vehicle added and RC submitted for review.');
                resetAddForm();
                fetchDashboard();
            } catch (err) {
                setMessage(err.response?.data?.message || 'Failed to add vehicle.');
            } finally {
                setSavingVehicle(false);
            }
        });
    };

    const handleUploadRc = async (e) => {
        e.preventDefault();
        if (!rcUploadTarget) return;
        if (!rcFile) {
            toast.error('Choose a clear photo of the RC.');
            return;
        }
        setSavingVehicle(true);
        setMessage('');
        try {
            const res = await verificationsApi.uploadRcOcr(rcUploadTarget.licensePlate, rcFile);
            toast.success(res.data.message || 'RC submitted for review.');
            setRcUploadTarget(null);
            setRcFile(null);
            fetchDashboard();
        } catch (err) {
            setMessage(err.response?.data?.message || 'RC upload failed.');
        } finally {
            setSavingVehicle(false);
        }
    };

    const rcLabel = (vehicle) => {
        if (vehicle.isVerified) return { text: 'RC verified', className: 'rc-ok' };
        if (vehicle.rcUrl) return { text: 'RC under review', className: 'rc-pending' };
        return { text: 'RC required', className: 'rc-needed' };
    };

    const handleVehiclePhoto = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (vehicleImages.length >= 5) {
            toast.error('Maximum 5 photos per vehicle.');
            return;
        }
        setUploadingImage(true);
        try {
            const res = await vehiclesApi.uploadImage(file);
            setVehicleImages((prev) => [...prev, res.data.data.url]);
            toast.success('Photo uploaded.');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Photo upload failed.');
        } finally {
            setUploadingImage(false);
            e.target.value = '';
        }
    };

    const openListingForm = (vehicle) => {
        if (!vehicle.isVerified) {
            if (!vehicle.rcUrl) {
                toast.error('Upload the vehicle RC first.');
                setRcUploadTarget(vehicle);
                setRcFile(null);
                return;
            }
            toast.error('Wait for admin to approve this vehicle RC before listing.');
            return;
        }
        setListingForm({ ...initialListingForm, vehicleId: vehicle.id });
        setShowListingForm(true);
    };

    const handleCreateListing = async (e) => {
        e.preventDefault();
        await requireListingCompliance(async () => {
            setMessage('');
            try {
                await rentalsApi.createListing(listingForm);
                toast.success('Listing published.');
                setShowListingForm(false);
                setListingForm(initialListingForm);
                fetchDashboard();
            } catch (err) {
                setMessage(err.response?.data?.message || 'Failed to list vehicle.');
            }
        });
    };

    return (
        <div className="host-page">
            <div className="container host-inner">
                <header className="host-header">
                    <div>
                        <h1>Host a Vehicle</h1>
                        <p>List your car, bike, or scooter and earn when travelers need wheels.</p>
                    </div>
                    <button type="button" className="host-add-btn" onClick={() => setShowAddForm(true)}>
                        Add vehicle
                    </button>
                </header>

                {message && <div className="host-banner warn">{message}</div>}

                {!kycStatus?.isFullyVerified && (
                    <div className="host-banner">
                        <Link to="/verify">Verify your identity</Link> before adding vehicles or listings.
                    </div>
                )}

                <div className="host-tabs" role="tablist">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={tab === 'vehicles'}
                        className={tab === 'vehicles' ? 'active' : ''}
                        onClick={() => setTab('vehicles')}
                    >
                        Vehicles Listed ({vehicles.length})
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={tab === 'bookings'}
                        className={tab === 'bookings' ? 'active' : ''}
                        onClick={() => setTab('bookings')}
                    >
                        Upcoming Bookings ({upcomingBookings.length})
                    </button>
                </div>

                {tab === 'vehicles' ? (
                    vehicles.length === 0 ? (
                        <div className="host-empty">
                            <h3>No vehicles yet</h3>
                            <p>Add your first car, bike, or scooter to start hosting on PackAndSync.</p>
                            <button type="button" className="host-add-btn" onClick={() => setShowAddForm(true)}>
                                Add vehicle
                            </button>
                        </div>
                    ) : (
                        <div className="host-vehicle-grid">
                            {vehicles.map((vehicle) => {
                                const listing = vehicle.listings?.[0];
                                const booked = Boolean(listing?.bookings?.length);
                                const price = formatPrice(listing?.pricePerDay);
                                const thumb = vehicle.images?.[0]
                                    || (isTwoWheeler(vehicle.type) ? FALLBACK_BIKE_THUMB : FALLBACK_THUMB);
                                const title = `${vehicle.make} ${vehicle.model}`.trim();
                                const rc = rcLabel(vehicle);
                                const needsRc = !vehicle.isVerified && !vehicle.rcUrl;

                                return (
                                    <article key={vehicle.id} className="host-v-card">
                                        <div className="host-v-top">
                                            <img src={thumb} alt={title} className="host-v-thumb" />
                                            <div className="host-v-meta">
                                                <h3>{title}</h3>
                                                <span className="host-type-badge">{typeLabel(vehicle.type)}</span>
                                                <span className={`host-v-status ${booked ? 'booked' : listing ? 'available' : 'idle'}`}>
                                                    {booked ? 'Booked' : listing ? 'Available' : 'Not listed'}
                                                </span>
                                                <span className={`host-rc-pill ${rc.className}`}>{rc.text}</span>
                                            </div>
                                        </div>
                                        <div className="host-v-foot">
                                            <strong className="host-v-price">
                                                {price || (needsRc ? 'RC photo required' : vehicle.isVerified ? 'Set a daily rate' : 'Awaiting RC approval')}
                                            </strong>
                                            {needsRc ? (
                                                <button
                                                    type="button"
                                                    className="host-v-action"
                                                    onClick={() => { setRcUploadTarget(vehicle); setRcFile(null); }}
                                                >
                                                    Upload RC
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="host-v-action"
                                                    onClick={() => openListingForm(vehicle)}
                                                    disabled={!vehicle.isVerified && !listing}
                                                >
                                                    {listing ? 'Update listing' : 'Create listing'}
                                                </button>
                                            )}
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )
                ) : upcomingBookings.length === 0 ? (
                    <div className="host-empty">
                        <h3>No upcoming bookings</h3>
                        <p>When renters request your cars or bikes, they will show up here.</p>
                    </div>
                ) : (
                    <div className="host-booking-list">
                        {upcomingBookings.map((booking) => {
                            const v = booking.listing?.vehicle;
                            const title = v ? `${v.make} ${v.model}` : 'Vehicle';
                            return (
                                <article key={booking.id} className="host-b-card">
                                    <div>
                                        <h3>{title}</h3>
                                        <p>
                                            {booking.renter?.name || 'Renter'} ·{' '}
                                            {new Date(booking.startDate).toLocaleDateString()} –{' '}
                                            {new Date(booking.endDate).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="host-b-meta">
                                        <strong>₹{Number(booking.totalPrice).toLocaleString()}</strong>
                                        <span className={`host-b-status ${booking.status.toLowerCase()}`}>
                                            {booking.status}
                                        </span>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>

            {showAddForm && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Add {typeLabel(formData.type).toLowerCase()}</h3>
                        <form onSubmit={handleAddVehicle}>
                            <div className="host-type-chips" role="group" aria-label="Vehicle type">
                                {VEHICLE_TYPES.map((t) => (
                                    <button
                                        key={t.id}
                                        type="button"
                                        className={`host-type-chip ${formData.type === t.id ? 'active' : ''}`}
                                        onClick={() => setVehicleType(t.id)}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                            <input
                                type="text"
                                placeholder={`Make (e.g. ${VEHICLE_TYPES.find((t) => t.id === formData.type)?.makeHint})`}
                                value={formData.make}
                                onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                                required
                            />
                            <input
                                type="text"
                                placeholder={`Model (e.g. ${VEHICLE_TYPES.find((t) => t.id === formData.type)?.modelHint})`}
                                value={formData.model}
                                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                                required
                            />
                            <input type="number" placeholder="Year" value={formData.year} onChange={(e) => setFormData({ ...formData, year: e.target.value })} required />
                            <input type="text" placeholder="License Plate" value={formData.licensePlate} onChange={(e) => setFormData({ ...formData, licensePlate: e.target.value.toUpperCase() })} required />
                            {!isTwoWheeler(formData.type) && (
                                <input type="number" placeholder="Seats" value={formData.seats} onChange={(e) => setFormData({ ...formData, seats: e.target.value })} required min="1" max="12" />
                            )}
                            <select value={formData.fuelType} onChange={(e) => setFormData({ ...formData, fuelType: e.target.value })}>
                                <option value="Petrol">Petrol</option>
                                {!isTwoWheeler(formData.type) && <option value="Diesel">Diesel</option>}
                                {!isTwoWheeler(formData.type) && <option value="CNG">CNG</option>}
                                <option value="Electric">Electric</option>
                            </select>
                            <select value={formData.transmission} onChange={(e) => setFormData({ ...formData, transmission: e.target.value })}>
                                {isTwoWheeler(formData.type) ? (
                                    <>
                                        <option value="Automatic">Automatic</option>
                                        <option value="Manual">Geared</option>
                                    </>
                                ) : (
                                    <>
                                        <option value="Automatic">Automatic</option>
                                        <option value="Manual">Manual</option>
                                    </>
                                )}
                            </select>
                            <label className="vehicle-photo-label">
                                Photos (up to 5)
                                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleVehiclePhoto} disabled={uploadingImage || savingVehicle} />
                            </label>
                            {vehicleImages.length > 0 && (
                                <div className="vehicle-photo-preview">
                                    {vehicleImages.map((url) => (
                                        <img key={url} src={url} alt="Vehicle" />
                                    ))}
                                </div>
                            )}
                            <label className="vehicle-photo-label">
                                RC photo (required)
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    required
                                    disabled={savingVehicle}
                                    onChange={(e) => setRcFile(e.target.files?.[0] || null)}
                                />
                            </label>
                            {rcFile && <p className="host-file-name">{rcFile.name}</p>}
                            <p className="host-form-hint">We scan the RC against the plate and send it to admin for approval before listing.</p>
                            <div className="modal-btns">
                                <button type="submit" className="save-btn" disabled={savingVehicle}>
                                    {savingVehicle ? 'Saving…' : `Save ${typeLabel(formData.type).toLowerCase()}`}
                                </button>
                                <button type="button" className="cancel-btn" disabled={savingVehicle} onClick={resetAddForm}>Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {rcUploadTarget && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Upload RC — {rcUploadTarget.make} {rcUploadTarget.model}</h3>
                        <p className="host-form-hint">Plate: {rcUploadTarget.licensePlate}. Use a clear photo of the registration certificate.</p>
                        <form onSubmit={handleUploadRc}>
                            <label className="vehicle-photo-label">
                                RC photo
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    required
                                    disabled={savingVehicle}
                                    onChange={(e) => setRcFile(e.target.files?.[0] || null)}
                                />
                            </label>
                            {rcFile && <p className="host-file-name">{rcFile.name}</p>}
                            <div className="modal-btns">
                                <button type="submit" className="save-btn" disabled={savingVehicle}>
                                    {savingVehicle ? 'Uploading…' : 'Submit RC'}
                                </button>
                                <button
                                    type="button"
                                    className="cancel-btn"
                                    disabled={savingVehicle}
                                    onClick={() => { setRcUploadTarget(null); setRcFile(null); }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showListingForm && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Create Rental Listing</h3>
                        <form onSubmit={handleCreateListing}>
                            <input type="number" min="1" placeholder="Price per day" value={listingForm.pricePerDay} onChange={(e) => setListingForm({ ...listingForm, pricePerDay: e.target.value })} required />
                            <input type="text" placeholder="Pickup location" value={listingForm.location} onChange={(e) => setListingForm({ ...listingForm, location: e.target.value })} required />
                            <textarea placeholder="Description" value={listingForm.description} onChange={(e) => setListingForm({ ...listingForm, description: e.target.value })} />
                            <label>Available from</label>
                            <input type="date" min={today} value={listingForm.availableFrom} onChange={(e) => setListingForm({ ...listingForm, availableFrom: e.target.value })} required />
                            <label>Available to</label>
                            <input type="date" min={listingForm.availableFrom} value={listingForm.availableTo} onChange={(e) => setListingForm({ ...listingForm, availableTo: e.target.value })} required />
                            <div className="modal-btns">
                                <button type="submit" className="save-btn">Publish Listing</button>
                                <button type="button" className="cancel-btn" onClick={() => setShowListingForm(false)}>Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <TermsAcceptanceModal
                isOpen={termsModal.open}
                policyType={termsModal.policyType}
                onAccept={handleTermsAccept}
                onClose={() => setTermsModal({ open: false, policyType: null, action: null })}
                loading={termsLoading}
            />
        </div>
    );
}
