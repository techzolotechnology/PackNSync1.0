import { useEffect, useMemo, useRef, useState } from 'react';
import './ExploreMap.css';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();

const loadGoogleMaps = () => {
    if (window.google?.maps?.importLibrary) return Promise.resolve(window.google.maps);
    if (!API_KEY) return Promise.resolve(null);

    return new Promise((resolve) => {
        const existing = document.querySelector('script[data-explore-map]');
        if (existing) {
            existing.addEventListener('load', () => resolve(window.google?.maps || null));
            return;
        }
        const script = document.createElement('script');
        script.dataset.exploreMap = '1';
        script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&loading=async`;
        script.async = true;
        script.onload = () => resolve(window.google?.maps || null);
        script.onerror = () => resolve(null);
        document.head.appendChild(script);
    });
};

function FallbackMap({ places, selectedId, onSelect }) {
    const bounds = useMemo(() => {
        if (!places?.length) return null;
        const lats = places.map((p) => p.lat);
        const lngs = places.map((p) => p.lng);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        const padLat = Math.max((maxLat - minLat) * 0.2, 0.02);
        const padLng = Math.max((maxLng - minLng) * 0.2, 0.02);
        return {
            minLat: minLat - padLat,
            maxLat: maxLat + padLat,
            minLng: minLng - padLng,
            maxLng: maxLng + padLng,
        };
    }, [places]);

    if (!places?.length || !bounds) {
        return <div className="explore-map-empty">Ask for places to see them on the map.</div>;
    }

    const project = (lat, lng) => {
        const x = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 100;
        const y = (1 - (lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * 100;
        return { left: `${x}%`, top: `${y}%` };
    };

    return (
        <div className="explore-map-fallback" aria-label="Place map">
            <div className="explore-map-grid" aria-hidden="true" />
            {places.map((p, i) => {
                const pos = project(p.lat, p.lng);
                return (
                    <button
                        key={p.id}
                        type="button"
                        className={`explore-pin ${selectedId === p.id ? 'active' : ''}`}
                        style={pos}
                        onClick={() => onSelect?.(p)}
                        title={p.name}
                    >
                        {i + 1}
                    </button>
                );
            })}
        </div>
    );
}

export default function ExploreMap({ places = [], selectedId, onSelect }) {
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const markersRef = useRef([]);
    const [useFallback, setUseFallback] = useState(!API_KEY);

    useEffect(() => {
        if (!API_KEY || !mapRef.current) return undefined;
        let cancelled = false;

        (async () => {
            const maps = await loadGoogleMaps();
            if (cancelled || !maps || !mapRef.current) {
                if (!cancelled) setUseFallback(true);
                return;
            }
            setUseFallback(false);
            const { Map } = await maps.importLibrary('maps');
            if (!mapInstance.current) {
                mapInstance.current = new Map(mapRef.current, {
                    center: { lat: 12.9716, lng: 77.5946 },
                    zoom: 11,
                    mapId: 'packandsync-explore',
                    disableDefaultUI: false,
                });
            }
        })();

        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (useFallback || !mapInstance.current || !window.google?.maps) return;

        markersRef.current.forEach((m) => m.setMap(null));
        markersRef.current = [];

        if (!places.length) return;

        const bounds = new window.google.maps.LatLngBounds();
        places.forEach((p, i) => {
            const pos = { lat: p.lat, lng: p.lng };
            bounds.extend(pos);
            const marker = new window.google.maps.Marker({
                map: mapInstance.current,
                position: pos,
                label: String(i + 1),
                title: p.name,
            });
            marker.addListener('click', () => onSelect?.(p));
            markersRef.current.push(marker);
        });

        if (places.length === 1) {
            mapInstance.current.setCenter(bounds.getCenter());
            mapInstance.current.setZoom(13);
        } else {
            mapInstance.current.fitBounds(bounds, 64);
        }
    }, [places, useFallback, onSelect]);

    useEffect(() => {
        if (useFallback || !selectedId || !mapInstance.current) return;
        const place = places.find((p) => p.id === selectedId);
        if (place) {
            mapInstance.current.panTo({ lat: place.lat, lng: place.lng });
        }
    }, [selectedId, places, useFallback]);

    if (useFallback) {
        return <FallbackMap places={places} selectedId={selectedId} onSelect={onSelect} />;
    }

    return <div ref={mapRef} className="explore-map-canvas" />;
}
