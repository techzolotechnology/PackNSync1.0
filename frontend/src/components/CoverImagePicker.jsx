import { useEffect, useRef, useState } from 'react';
import { tripsApi } from '../api/index.js';
import './CoverImagePicker.css';

export default function CoverImagePicker({ place, value, onChange }) {
    const [options, setOptions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const requestIdRef = useRef(0);

    useEffect(() => {
        const q = String(place || '').trim();
        if (q.length < 2) {
            setOptions([]);
            setError('');
            setLoading(false);
            return;
        }

        const requestId = ++requestIdRef.current;
        const timer = setTimeout(async () => {
            setLoading(true);
            setError('');
            try {
                const res = await tripsApi.getCoverSuggestions(q);
                if (requestId !== requestIdRef.current) return;
                const list = res.data.data || [];
                setOptions(list);
                if (list.length && !value) {
                    onChange?.(list[0].url);
                } else if (list.length && value && !list.some((img) => img.url === value)) {
                    // keep previous selection if still valid; otherwise pick first
                }
            } catch (err) {
                if (requestId !== requestIdRef.current) return;
                setOptions([]);
                setError(err.response?.data?.message || 'Could not load cover suggestions.');
            } finally {
                if (requestId === requestIdRef.current) setLoading(false);
            }
        }, 450);

        return () => clearTimeout(timer);
    }, [place]);

    if (!String(place || '').trim()) {
        return (
            <div className="cover-picker">
                <p className="cover-picker-hint">Choose a destination to see cover photo suggestions.</p>
            </div>
        );
    }

    return (
        <div className="cover-picker">
            <div className="cover-picker-head">
                <span>Cover photo</span>
                <small>Real photos for this place — pick one</small>
            </div>
            {loading && <p className="cover-picker-hint">Finding photos for “{place.trim()}”…</p>}
            {!loading && error && <p className="cover-picker-error">{error}</p>}
            {!loading && !error && options.length === 0 && (
                <p className="cover-picker-hint">No covers found. Try a clearer place name.</p>
            )}
            <div className="cover-picker-grid" role="listbox" aria-label="Cover photo options">
                {options.map((img) => {
                    const selected = value === img.url;
                    return (
                        <button
                            key={img.id}
                            type="button"
                            role="option"
                            aria-selected={selected}
                            className={`cover-picker-option ${selected ? 'selected' : ''}`}
                            onClick={() => onChange?.(img.url)}
                            title={img.title}
                        >
                            <img src={img.thumb || img.url} alt={img.title || 'Cover option'} loading="lazy" />
                            {selected && <span className="cover-picker-check">Selected</span>}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
