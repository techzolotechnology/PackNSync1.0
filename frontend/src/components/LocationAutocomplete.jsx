import React, { useEffect, useRef, useState } from 'react';
import './LocationAutocomplete.css';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();

let mapsLoaderPromise = null;

function loadGoogleMaps() {
    if (!API_KEY) return Promise.resolve(null);
    if (window.google?.maps?.importLibrary) return Promise.resolve(window.google.maps);
    if (mapsLoaderPromise) return mapsLoaderPromise;

    mapsLoaderPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&loading=async`;
        script.async = true;
        script.onload = () => resolve(window.google?.maps || null);
        script.onerror = () => reject(new Error('Failed to load Google Maps'));
        document.head.appendChild(script);
    });

    return mapsLoaderPromise;
}

async function fetchPhotonSuggestions(input) {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(input)}&limit=6&lang=en`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.features || []).map((f, i) => {
        const p = f.properties || {};
        const parts = [p.name, p.city, p.state, p.country].filter(Boolean);
        const description = [...new Set(parts)].join(', ') || p.name || 'Unknown place';
        const [lng, lat] = f.geometry?.coordinates || [];
        return {
            place_id: `photon-${p.osm_id || i}-${description}`,
            description,
            lat: Number.isFinite(lat) ? lat : null,
            lng: Number.isFinite(lng) ? lng : null,
            source: 'photon',
        };
    }).filter((s) => s.description);
}

export default function LocationAutocomplete({
    placeholder,
    onSelect,
    value,
    onChange,
    className = '',
    icon = null,
    id,
}) {
    const [suggestions, setSuggestions] = useState([]);
    const [show, setShow] = useState(false);
    const [ready, setReady] = useState(!API_KEY);
    const [loading, setLoading] = useState(false);
    const legacyServiceRef = useRef(null);
    const legacyPlacesRef = useRef(null);
    const useNewApiRef = useRef(true);
    const debounceRef = useRef(null);
    const requestIdRef = useRef(0);

    useEffect(() => {
        if (!API_KEY) {
            setReady(true);
            return;
        }

        loadGoogleMaps()
            .then(async (maps) => {
                if (!maps) {
                    setReady(true);
                    return;
                }
                try {
                    await maps.importLibrary('places');
                    useNewApiRef.current = true;
                } catch {
                    useNewApiRef.current = false;
                    if (maps.places) {
                        legacyServiceRef.current = new maps.places.AutocompleteService();
                        legacyPlacesRef.current = new maps.places.PlacesService(document.createElement('div'));
                    }
                }
                setReady(true);
            })
            .catch((err) => {
                console.warn('[LocationAutocomplete]', err.message);
                setReady(true);
            });
    }, []);

    const fetchNewSuggestions = async (input) => {
        const { AutocompleteSuggestion } = await window.google.maps.importLibrary('places');
        const { suggestions: results } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input,
            includedRegionCodes: ['in'],
        });
        return (results || []).map((item) => ({
            place_id: item.placePrediction?.placeId,
            description: item.placePrediction?.text?.text
                || item.placePrediction?.structuredFormat?.mainText?.text
                || '',
            source: 'google',
        })).filter((s) => s.place_id && s.description);
    };

    const fetchLegacySuggestions = (input) => new Promise((resolve) => {
        if (!legacyServiceRef.current) return resolve([]);
        legacyServiceRef.current.getPlacePredictions(
            { input, componentRestrictions: { country: 'in' } },
            (predictions, status) => {
                if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions?.length) {
                    resolve(predictions.map((p) => ({ ...p, source: 'google' })));
                } else {
                    resolve([]);
                }
            },
        );
    });

    const resolvePlaceCoords = async (prediction) => {
        const label = prediction.description;

        if (prediction.source === 'photon') {
            return { label, lat: prediction.lat, lng: prediction.lng };
        }

        if (useNewApiRef.current && window.google?.maps) {
            try {
                const { Place } = await window.google.maps.importLibrary('places');
                const place = new Place({ id: prediction.place_id });
                await place.fetchFields({ fields: ['formattedAddress', 'location'] });
                if (place.location) {
                    return {
                        label: place.formattedAddress || label,
                        lat: place.location.lat(),
                        lng: place.location.lng(),
                    };
                }
            } catch (err) {
                console.warn('[LocationAutocomplete] Place details failed:', err.message);
            }
        } else if (legacyPlacesRef.current) {
            return new Promise((resolve) => {
                legacyPlacesRef.current.getDetails(
                    { placeId: prediction.place_id, fields: ['geometry', 'formatted_address'] },
                    (place, status) => {
                        if (status === window.google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
                            resolve({
                                label: place.formatted_address || label,
                                lat: place.geometry.location.lat(),
                                lng: place.geometry.location.lng(),
                            });
                        } else {
                            resolve({ label, lat: null, lng: null });
                        }
                    },
                );
            });
        }

        return { label, lat: null, lng: null };
    };

    const handleInput = (e) => {
        const val = e.target.value;
        onChange(val);

        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (val.trim().length < 2) {
            setSuggestions([]);
            setShow(false);
            setLoading(false);
            return;
        }

        debounceRef.current = setTimeout(async () => {
            const requestId = ++requestIdRef.current;
            setLoading(true);
            try {
                let results = [];
                if (API_KEY && ready && window.google?.maps) {
                    try {
                        results = useNewApiRef.current
                            ? await fetchNewSuggestions(val)
                            : await fetchLegacySuggestions(val);
                    } catch (err) {
                        console.warn('[LocationAutocomplete] Google failed, using Photon:', err.message);
                    }
                }
                if (!results.length) {
                    results = await fetchPhotonSuggestions(val);
                }
                if (requestId !== requestIdRef.current) return;
                setSuggestions(results);
                setShow(results.length > 0);
            } catch (err) {
                console.warn('[LocationAutocomplete] suggestions failed:', err.message);
                if (requestId === requestIdRef.current) {
                    setSuggestions([]);
                    setShow(false);
                }
            } finally {
                if (requestId === requestIdRef.current) setLoading(false);
            }
        }, 280);
    };

    const handleSelect = async (prediction) => {
        onChange(prediction.description);
        setShow(false);
        setSuggestions([]);
        const location = await resolvePlaceCoords(prediction);
        onSelect?.(location);
    };

    return (
        <div className={`location-autocomplete ${icon ? 'has-icon' : ''} ${className}`.trim()}>
            {icon && <span className="location-autocomplete-icon">{icon}</span>}
            <input
                id={id}
                type="text"
                className="location-autocomplete-input"
                placeholder={placeholder}
                value={value}
                onChange={handleInput}
                onFocus={() => suggestions.length > 0 && setShow(true)}
                onBlur={() => setTimeout(() => setShow(false), 180)}
                autoComplete="off"
                role="combobox"
                aria-expanded={show}
                aria-autocomplete="list"
            />
            {loading && <span className="location-autocomplete-loading" aria-hidden="true" />}
            {show && suggestions.length > 0 && (
                <ul className="location-suggestions" role="listbox">
                    {suggestions.map((s) => (
                        <li key={s.place_id} role="option">
                            <button
                                type="button"
                                className="location-suggestion-item"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleSelect(s);
                                }}
                            >
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
                                    <path d="M12 21s7-5.3 7-11a7 7 0 10-14 0c0 5.7 7 11 7 11z" stroke="currentColor" strokeWidth="1.7" />
                                    <circle cx="12" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.7" />
                                </svg>
                                <span>{s.description}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
