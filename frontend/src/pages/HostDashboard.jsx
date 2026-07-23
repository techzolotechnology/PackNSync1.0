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
    if (n < 1000) return `$${n.toLocaleString()} per day`;
    return `₹${n.toLocaleString()} per day`;
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
    const [uploadingImage, setUploadingImage] = useState(false);
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

    const handleAddVehicle = async (e) => {
        e.preventDefault();
        await requireListingCompliance(async () => {
            setMessage('');
            try {
                await vehiclesApi.create({ ...formData, images: vehicleImages });
                toast.success('Vehicle added. Upload RC photo on the Verify page for OCR auto-check.');
                setShowAddForm(false);
                setFormData(initialVehicleForm);
                setVehicleImages([]);
                fetchDashboard();
            } catch (err) {
                setMessage(err.response?.data?.message || 'Failed to add vehicle.');
            }
        });
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

    const openListingForm = (vehicleId) => {
        setListingForm({ ...initialListingForm, vehicleId });
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
                        <p>List your car to earn and share the ride with fellow travelers.</p>
                    </div>
                    <button type="button" className="host-add-btn" onClick={() => setShowAddForm(true)}>
                        Add Your Vehicle
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
                            <p>Add your first car to start hosting on PackAndSync.</p>
                            <button type="button" className="host-add-btn" onClick={() => setShowAddForm(true)}>
                                Add Your Vehicle
                            </button>
                        </div>
                    ) : (
                        <div className="host-vehicle-grid">
                            {vehicles.map((vehicle) => {
                                const listing = vehicle.listings?.[0];
                                const booked = Boolean(listing?.bookings?.length);
                                const price = formatPrice(listing?.pricePerDay);
                                const thumb = vehicle.images?.[0] || FALLBACK_THUMB;
                                const title = `${vehicle.make} ${vehicle.model}`.trim();

                                return (
                                    <article key={vehicle.id} className="host-v-card">
                                        <div className="host-v-top">
                                            <img src={thumb} alt={title} className="host-v-thumb" />
                                            <div className="host-v-meta">
                                                <h3>{title}</h3>
                                                <span className={`host-v-status ${booked ? 'booked' : 'available'}`}>
                                                    {booked ? 'Booked' : listing ? 'Available' : 'Not listed'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="host-v-foot">
                                            <strong className="host-v-price">
                                                {price || 'Set a daily rate'}
                                            </strong>
                                            <button
                                                type="button"
                                                className="host-v-action"
                                                onClick={() => openListingForm(vehicle.id)}
                                            >
                                                {listing ? 'Update listing' : 'Create listing'}
                                            </button>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )
                ) : upcomingBookings.length === 0 ? (
                    <div className="host-empty">
                        <h3>No upcoming bookings</h3>
                        <p>When renters request your cars, they will show up here.</p>
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
                        <h3>Add New Vehicle</h3>
                        <form onSubmit={handleAddVehicle}>
                            <input type="text" placeholder="Make (e.g. Toyota)" value={formData.make} onChange={(e) => setFormData({ ...formData, make: e.target.value })} required />
                            <input type="text" placeholder="Model (e.g. Innova)" value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })} required />
                            <input type="number" placeholder="Year" value={formData.year} onChange={(e) => setFormData({ ...formData, year: e.target.value })} required />
                            <input type="text" placeholder="License Plate" value={formData.licensePlate} onChange={(e) => setFormData({ ...formData, licensePlate: e.target.value.toUpperCase() })} required />
                            <input type="number" placeholder="Seats" value={formData.seats} onChange={(e) => setFormData({ ...formData, seats: e.target.value })} required />
                            <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })}>
                                <option value="CAR">Car</option>
                                <option value="BIKE">Bike</option>
                            </select>
                            <select value={formData.fuelType} onChange={(e) => setFormData({ ...formData, fuelType: e.target.value })}>
                                <option value="Petrol">Petrol</option>
                                <option value="Diesel">Diesel</option>
                                <option value="CNG">CNG</option>
                                <option value="Electric">Electric</option>
                            </select>
                            <select value={formData.transmission} onChange={(e) => setFormData({ ...formData, transmission: e.target.value })}>
                                <option value="Automatic">Automatic</option>
                                <option value="Manual">Manual</option>
                            </select>
                            <label className="vehicle-photo-label">
                                Vehicle photos (up to 5)
                                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleVehiclePhoto} disabled={uploadingImage} />
                            </label>
                            {vehicleImages.length > 0 && (
                                <div className="vehicle-photo-preview">
                                    {vehicleImages.map((url) => (
                                        <img key={url} src={url} alt="Vehicle" />
                                    ))}
                                </div>
                            )}
                            <div className="modal-btns">
                                <button type="submit" className="save-btn">Save Vehicle</button>
                                <button type="button" className="cancel-btn" onClick={() => { setShowAddForm(false); setVehicleImages([]); }}>Cancel</button>
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
