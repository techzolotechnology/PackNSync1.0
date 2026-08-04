import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { exploreApi } from '../api/index.js';
import ExploreMap from '../components/ExploreMap.jsx';
import ExplorePlanner from '../components/ExplorePlanner.jsx';
import useGoFlyMotion from '../hooks/useGoFlyMotion.js';
import './ExplorePage.css';

const SESSION_KEY = 'packandsync-explore-session';
const FALLBACK_IMG =
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=70';

function PlaceCard({ place, index, selected, saved, onSelect, onToggleSave }) {
    const img = place.photoUrl || FALLBACK_IMG;
    return (
        <article
            className={`explore-place-card ps-reveal ps-image-reveal ps-lift ${selected ? 'active' : ''}`}
            style={{ '--ps-delay': `${(index % 5) * 70}ms` }}
            onClick={() => onSelect(place)}
            onKeyDown={(e) => e.key === 'Enter' && onSelect(place)}
            role="button"
            tabIndex={0}
        >
            <div className="explore-place-media">
                <img src={img} alt={place.name} loading="lazy" />
                <span className="explore-place-rank">{index + 1}</span>
                {place.rating != null && (
                    <span className="explore-place-rating">
                        {place.rating}★
                        {place.userRatingsTotal != null ? ` · ${place.userRatingsTotal}` : ''}
                    </span>
                )}
            </div>
            <div className="explore-place-body">
                <h4>{place.name}</h4>
                <p className="explore-place-addr">{place.address || place.city}</p>
                {place.bestFor && (
                    <p className="explore-place-best">
                        <strong>Best for:</strong> {place.bestFor}
                    </p>
                )}
                <p className="explore-place-reason">{place.reason}</p>
                <div className="explore-place-meta">
                    {place.distanceKm != null && <span>{place.distanceKm} km</span>}
                    {place.fitScore != null && <span>Fit {place.fitScore}/10</span>}
                    {place.hours && <span>{place.hours}</span>}
                    {place.priceLevel != null && (
                        <span>{'₹'.repeat(Math.min(4, Math.max(1, place.priceLevel + 1)))}</span>
                    )}
                </div>
                <div className="explore-place-actions">
                    <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleSave(place);
                        }}
                    >
                        {saved ? 'Saved' : 'Save'}
                    </button>
                    <a
                        className="btn btn-ghost btn-sm"
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name} ${place.address || ''}`)}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                    >
                        Maps
                    </a>
                </div>
            </div>
        </article>
    );
}

export default function ExplorePage() {
    const [mode, setMode] = useState('chat'); // chat | planner
    const [sessionId, setSessionId] = useState(() => localStorage.getItem(SESSION_KEY) || '');
    const [messages, setMessages] = useState([]);
    const [places, setPlaces] = useState([]);
    const [planPlaces, setPlanPlaces] = useState([]);
    const [intent, setIntent] = useState(null);
    const [selectedId, setSelectedId] = useState(null);
    const [saved, setSaved] = useState([]);
    const [input, setInput] = useState('');
    const [examples, setExamples] = useState([]);
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(false);
    const [coords, setCoords] = useState(null);
    const threadRef = useRef(null);
    const motionRef = useRef(null);
    useGoFlyMotion(motionRef, [messages, places, planPlaces, mode, loading]);

    const mapPlaces = mode === 'planner' ? planPlaces : places;

    useEffect(() => {
        exploreApi.getExamples().then((res) => setExamples(res.data.data || [])).catch(() => {});
        exploreApi.getStatus().then((res) => setStatus(res.data.data)).catch(() => {});
    }, []);

    // Reuse an already-granted location so results are local without re-prompting.
    useEffect(() => {
        if (!navigator.geolocation || !navigator.permissions?.query) return;
        navigator.permissions.query({ name: 'geolocation' })
            .then((perm) => {
                if (perm.state !== 'granted') return;
                navigator.geolocation.getCurrentPosition(
                    (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                    () => {},
                    { timeout: 8000, maximumAge: 300000 },
                );
            })
            .catch(() => {});
    }, []);

    const requestLocation = async ({ silent = false } = {}) => {
        if (!navigator.geolocation) {
            if (!silent) toast.error('This browser cannot share location.');
            return null;
        }
        try {
            const pos = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 300000,
                });
            });
            const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setCoords(next);
            if (!silent) toast.success('Using your location for nearby results.');
            return next;
        } catch {
            if (!silent) toast.error('Allow location access, or name a city like “in Bangalore”.');
            return null;
        }
    };

    useEffect(() => {
        if (!sessionId) return;
        exploreApi.getChat(sessionId)
            .then((res) => {
                const s = res.data.data?.session;
                if (!s) return;
                setSessionId(s.id);
                localStorage.setItem(SESSION_KEY, s.id);
                setMessages(s.messages || []);
                setPlaces(s.places || []);
                setIntent(s.intent || null);
                setSelectedId(s.places?.[0]?.id || null);
            })
            .catch(() => {
                localStorage.removeItem(SESSION_KEY);
                setSessionId('');
            });
    }, []);

    useEffect(() => {
        if (threadRef.current) {
            threadRef.current.scrollTop = threadRef.current.scrollHeight;
        }
    }, [messages, loading]);

    const onPlanPlaces = useCallback((list) => {
        setPlanPlaces(list || []);
        if (list?.[0]?.id) setSelectedId(list[0].id);
    }, []);

    const send = async (text = input) => {
        const q = String(text || '').trim();
        if (!q) return toast.error('Type a message.');
        setInput('');
        setLoading(true);

        setMessages((prev) => [
            ...prev,
            { id: `local-${Date.now()}`, role: 'user', content: q, createdAt: new Date().toISOString() },
        ]);

        try {
            let origin = coords;
            if (!origin && /\bnear me\b|\bnearby\b|\baround me\b/i.test(q)) {
                origin = await requestLocation();
            }

            const res = await exploreApi.chat(q, {
                sessionId: sessionId || undefined,
                lat: origin?.lat,
                lng: origin?.lng,
                limit: 5,
            });
            const data = res.data.data || {};
            const s = data.session;
            if (s?.id) {
                setSessionId(s.id);
                localStorage.setItem(SESSION_KEY, s.id);
                setMessages(s.messages || []);
            }
            const list = data.places || [];
            setPlaces(list);
            setIntent(data.intent || null);
            setSelectedId(list[0]?.id || selectedId);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Chat failed.');
            setMessages((prev) => [
                ...prev,
                {
                    id: `err-${Date.now()}`,
                    role: 'assistant',
                    content: 'Something went wrong looking that up. Try again with a city name.',
                    createdAt: new Date().toISOString(),
                },
            ]);
        } finally {
            setLoading(false);
        }
    };

    const clearChat = async () => {
        setLoading(true);
        try {
            const res = await exploreApi.clearChat(sessionId || undefined);
            const s = res.data.data?.session;
            setSessionId(s?.id || '');
            if (s?.id) localStorage.setItem(SESSION_KEY, s.id);
            else localStorage.removeItem(SESSION_KEY);
            setMessages([]);
            setPlaces([]);
            setIntent(null);
            setSelectedId(null);
            toast.success('Chat cleared.');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not clear chat.');
        } finally {
            setLoading(false);
        }
    };

    const toggleSave = (place) => {
        setSaved((prev) => (
            prev.some((p) => p.id === place.id)
                ? prev.filter((p) => p.id !== place.id)
                : [...prev, place]
        ));
    };

    return (
        <div className="explore-page page-atmosphere page-enter" ref={motionRef}>
            <aside className="explore-side">
                <div className="explore-mode-tabs ps-reveal">
                    <button
                        type="button"
                        className={mode === 'chat' ? 'active' : ''}
                        onClick={() => setMode('chat')}
                    >
                        Place chat
                    </button>
                    <button
                        type="button"
                        className={mode === 'planner' ? 'active' : ''}
                        onClick={() => setMode('planner')}
                    >
                        Trip planner
                    </button>
                </div>

                {mode === 'planner' ? (
                    <ExplorePlanner
                        onPlanPlaces={onPlanPlaces}
                        selectedId={selectedId}
                        onSelectStop={(stop) => setSelectedId(stop.id)}
                    />
                ) : (
                    <>
                        <header className="explore-side-head ps-reveal ps-left">
                            <div className="explore-side-top">
                                <div>
                                    <p className="explore-kicker">Explore chat</p>
                                    <h1 className="font-display">Ask the map</h1>
                                </div>
                                <button type="button" className="explore-clear" onClick={clearChat} disabled={loading}>
                                    Clear chat
                                </button>
                            </div>
                            <p>
                                Multi-turn chat with memory. Places show photo, rating, “best for”, and why they fit.
                                {status && (
                                    <span className="explore-status-line">
                                        {' '}
                                        · OpenAI {status.openai ? 'on' : 'off'}
                                        {' · '}
                                        Places {status.googlePlaces ? 'Google' : 'OSM'}
                                    </span>
                                )}
                            </p>
                        </header>

                        <div className="explore-thread" ref={threadRef}>
                            {messages.length === 0 && (
                                <div className="explore-empty">
                                    <p>Try a vibe, then refine — e.g. “cheaper” or “closer to Indiranagar”.</p>
                                    <div className="explore-examples">
                                        {examples.slice(0, 4).map((ex) => (
                                            <button key={ex} type="button" disabled={loading} onClick={() => send(ex)}>
                                                {ex}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {messages.map((m) => (
                                <div key={m.id} className={`explore-bubble ps-reveal ${m.role === 'user' ? 'ps-right' : 'ps-left'} ${m.role}`}>
                                    <p>{m.content}</p>
                                    {m.role === 'assistant' && m.places?.length > 0 && (
                                        <div className="explore-bubble-places">
                                            {m.places.map((place, index) => (
                                                <PlaceCard
                                                    key={`${m.id}-${place.id}`}
                                                    place={place}
                                                    index={index}
                                                    selected={selectedId === place.id}
                                                    saved={saved.some((p) => p.id === place.id)}
                                                    onSelect={(p) => setSelectedId(p.id)}
                                                    onToggleSave={toggleSave}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}

                            {loading && (
                                <div className="explore-bubble assistant">
                                    <p>Thinking & searching places…</p>
                                </div>
                            )}
                        </div>

                        {intent && (
                            <div className="explore-intent">
                                {intent.city && <span>{intent.city}</span>}
                                {(intent.intents || []).map((i) => (
                                    <span key={i}>{i}</span>
                                ))}
                            </div>
                        )}

                        {places.length > 0 && messages.every((m) => !m.places?.length) && (
                            <div className="explore-latest-places">
                                {places.map((place, index) => (
                                    <PlaceCard
                                        key={place.id}
                                        place={place}
                                        index={index}
                                        selected={selectedId === place.id}
                                        saved={saved.some((p) => p.id === place.id)}
                                        onSelect={(p) => setSelectedId(p.id)}
                                        onToggleSave={toggleSave}
                                    />
                                ))}
                            </div>
                        )}

                        <div className="explore-geo-row">
                            <button
                                type="button"
                                className={`explore-geo-btn ${coords ? 'active' : ''}`}
                                onClick={() => (coords ? setCoords(null) : requestLocation())}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                    <path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11z" stroke="currentColor" strokeWidth="1.8" />
                                    <circle cx="12" cy="10" r="2.2" fill="currentColor" />
                                </svg>
                                {coords ? 'Using your location' : 'Use my location'}
                            </button>
                            <span className="explore-geo-hint">
                                {coords ? 'Tap to turn off' : 'Or name a city in your message'}
                            </span>
                        </div>

                        <form
                            className="explore-composer"
                            onSubmit={(e) => {
                                e.preventDefault();
                                send();
                            }}
                        >
                            <textarea
                                rows={2}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder='e.g. “quiet romantic drinks in Bangalore”'
                                disabled={loading}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        send();
                                    }
                                }}
                            />
                            <button type="submit" className="btn btn-primary" disabled={loading || !input.trim()}>
                                Send
                            </button>
                        </form>

                        {saved.length > 0 && (
                            <div className="explore-saved">
                                <h2>Saved ({saved.length})</h2>
                                <ol>
                                    {saved.map((p) => (
                                        <li key={p.id}>{p.name}</li>
                                    ))}
                                </ol>
                                <Link to="/trips/create" className="btn btn-primary w-full">
                                    Post as Travel Together trip
                                </Link>
                            </div>
                        )}
                    </>
                )}
            </aside>

            <section className="explore-map-pane ps-reveal ps-right" aria-label="Map results">
                <ExploreMap
                    places={mapPlaces}
                    selectedId={selectedId}
                    onSelect={(p) => setSelectedId(p.id)}
                />
            </section>
        </div>
    );
}
