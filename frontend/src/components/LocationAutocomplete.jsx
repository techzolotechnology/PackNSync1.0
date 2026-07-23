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

export default function LocationAutocomplete({ placeholder, onSelect, value, onChange }) {
    const [suggestions, setSuggestions] = useState([]);
    const [show, setShow] = useState(false);
    const [ready, setReady] = useState(false);
    const legacyServiceRef = useRef(null);
    const legacyPlacesRef = useRef(null);
    const useNewApiRef = useRef(true);

    useEffect(() => {
        if (!API_KEY) return;

        loadGoogleMaps()
            .then(async (maps) => {
                if (!maps) return;
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
            .catch((err) => console.warn('[LocationAutocomplete]', err.message));
    }, []);

    const fetchNewSuggestions = async (input) => {
        const { AutocompleteSuggestion } = await window.google.maps.importLibrary('places');
        const { suggestions: results } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input,
            includedRegionCodes: ['in'],
        });
        return (results || []).map((item) => ({
            place_id: item.placePrediction?.placeId,
            description: item.placePrediction?.text?.text || item.placePrediction?.structuredFormat?.mainText?.text || '',
        })).filter((s) => s.place_id && s.description);
    };

    const fetchLegacySuggestions = (input) => new Promise((resolve) => {
        if (!legacyServiceRef.current) return resolve([]);
        legacyServiceRef.current.getPlacePredictions({ input }, (predictions, status) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions?.length) {
                resolve(predictions);
            } else {
                resolve([]);
            }
        });
    });

    const resolvePlaceCoords = async (prediction) => {
        const label = prediction.description;

        if (useNewApiRef.current) {
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
                    }
                );
            });
        }

        return { label, lat: null, lng: null };
    };

    const handleInput = async (e) => {
        const val = e.target.value;
        onChange(val);

        if (val.length <= 2 || !ready) {
            setSuggestions([]);
            setShow(false);
            return;
        }

        try {
            let results = [];
            if (useNewApiRef.current) {
                results = await fetchNewSuggestions(val);
            } else {
                results = await fetchLegacySuggestions(val);
            }
            setSuggestions(results);
            setShow(results.length > 0);
        } catch (err) {
            console.warn('[LocationAutocomplete] suggestions failed:', err.message);
            setSuggestions([]);
            setShow(false);
        }
    };

    const handleSelect = async (prediction) => {
        onChange(prediction.description);
        setShow(false);
        const location = await resolvePlaceCoords(prediction);
        onSelect(location);
    };

    return (
        <div className="location-autocomplete">
            <input
                type="text"
                className="location-autocomplete-input"
                placeholder={placeholder}
                value={value}
                onChange={handleInput}
                onBlur={() => setTimeout(() => setShow(false), 200)}
            />
            {!API_KEY && value.length > 2 && (
                <p className="location-autocomplete-hint">
                    Add VITE_GOOGLE_MAPS_API_KEY in frontend/.env for address suggestions
                </p>
            )}
            {show && suggestions.length > 0 && (
                <ul className="location-suggestions">
                    {suggestions.map((s) => (
                        <li
                            key={s.place_id}
                            className="location-suggestion-item"
                            onMouseDown={() => handleSelect(s)}
                        >
                            {s.description}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
