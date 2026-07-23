import React, { useEffect, useRef, useState } from 'react';
import { geocodeAddress } from '../utils/geocode.js';
import './RentalMap.css';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();

const loadGoogleMaps = () => {
    if (window.google?.maps?.importLibrary) return Promise.resolve(window.google.maps);
    if (!API_KEY) return Promise.resolve(null);

    return new Promise((resolve) => {
        const existing = document.querySelector('script[data-rental-map]');
        if (existing) {
            existing.addEventListener('load', () => resolve(window.google?.maps || null));
            return;
        }
        const script = document.createElement('script');
        script.dataset.rentalMap = '1';
        script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&loading=async`;
        script.async = true;
        script.onload = () => resolve(window.google?.maps || null);
        script.onerror = () => resolve(null);
        document.head.appendChild(script);
    });
};

export default function RentalMap({ listings, selectedId, onSelect, rentalDays }) {
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const markersRef = useRef([]);
    const [coordsById, setCoordsById] = useState({});
    const [mapError, setMapError] = useState('');

    useEffect(() => {
        if (!listings?.length) return;

        let cancelled = false;
        (async () => {
            const next = {};
            await Promise.all(
                listings.map(async (listing) => {
                    const geo = await geocodeAddress(listing.location);
                    if (geo) next[listing.id] = geo;
                })
            );
            if (!cancelled) setCoordsById(next);
        })();

        return () => { cancelled = true; };
    }, [listings]);

    useEffect(() => {
        if (!mapRef.current || !API_KEY) return;

        let cancelled = false;
        (async () => {
            const maps = await loadGoogleMaps();
            if (cancelled || !maps || !mapRef.current) return;

            const { Map } = await maps.importLibrary('maps');
            if (!mapInstance.current) {
                mapInstance.current = new Map(mapRef.current, {
                    center: { lat: 12.9716, lng: 77.5946 },
                    zoom: 11,
                    mapId: 'packandsync-rentals',
                    disableDefaultUI: false,
                });
            }
        })();

        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (!mapInstance.current || !window.google?.maps) return;

        markersRef.current.forEach((m) => m.setMap(null));
        markersRef.current = [];

        const points = listings
            .map((l) => ({ listing: l, coords: coordsById[l.id] }))
            .filter((p) => p.coords);

        if (!points.length) return;

        const bounds = new window.google.maps.LatLngBounds();

        points.forEach(({ listing, coords }) => {
            const marker = new window.google.maps.Marker({
                map: mapInstance.current,
                position: { lat: coords.lat, lng: coords.lng },
                title: `${listing.vehicle.make} ${listing.vehicle.model}`,
            });
            marker.addListener('click', () => onSelect?.(listing.id));
            markersRef.current.push(marker);
            bounds.extend({ lat: coords.lat, lng: coords.lng });
        });

        mapInstance.current.fitBounds(bounds, 48);

        if (selectedId && coordsById[selectedId]) {
            const c = coordsById[selectedId];
            mapInstance.current.panTo({ lat: c.lat, lng: c.lng });
        }
    }, [listings, coordsById, selectedId, onSelect]);

    useEffect(() => {
        if (!API_KEY) setMapError('Add VITE_GOOGLE_MAPS_API_KEY for the map view.');
    }, []);

    const pinnedCount = Object.keys(coordsById).length;

    return (
        <div className="rental-map-panel">
            <div className="rental-map-header">
                <h3>Map view</h3>
                <span>{pinnedCount} of {listings.length} pinned</span>
            </div>
            {mapError ? (
                <div className="rental-map-fallback">{mapError}</div>
            ) : (
                <div ref={mapRef} className="rental-map-canvas" role="application" aria-label="Rental listings map" />
            )}
            {pinnedCount > 0 && (
                <p className="rental-map-hint">Click a pin to highlight the listing. Totals shown for {rentalDays} day{rentalDays > 1 ? 's' : ''}.</p>
            )}
        </div>
    );
}
