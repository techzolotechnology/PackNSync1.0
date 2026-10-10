import { useEffect, useLayoutEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Scroll position per history entry, like a normal website:
 * new pages open at the top; Back/Forward return to where the reader was.
 *
 * The browser's own restoration runs before the next page has rendered its
 * content, so it lands short or jumps. We restore manually instead, retrying
 * for a moment while the content grows, and stop as soon as the reader scrolls.
 *
 * Also marks <html data-nav="pop|push"> so CSS can skip entrance animations
 * when returning to a page (see motion.css).
 */
const STORAGE_KEY = 'pns-scroll-positions';
const MAX_ENTRIES = 50;
const RESTORE_TIMEOUT_MS = 1500;

const positions = new Map();
let currentKey = null;

function loadSaved() {
    try {
        const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
        Object.entries(saved).forEach(([key, y]) => positions.set(key, Number(y) || 0));
    } catch { /* storage unavailable */ }
}

function persist() {
    try {
        const entries = [...positions.entries()].slice(-MAX_ENTRIES);
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch { /* storage unavailable */ }
}

function remember(key, y) {
    positions.delete(key);
    positions.set(key, y);
    if (positions.size > MAX_ENTRIES) positions.delete(positions.keys().next().value);
}

if (typeof window !== 'undefined') {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
    loadSaved();
}

/** Scroll to y once the page is tall enough; gives up after a moment or when the reader scrolls. */
function restoreScroll(y) {
    let frame = 0;
    let stopped = false;
    const started = performance.now();
    const stop = () => {
        stopped = true;
        if (frame) cancelAnimationFrame(frame);
        ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach((type) => window.removeEventListener(type, stop));
    };
    ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach((type) => window.addEventListener(type, stop, { passive: true }));

    const attempt = () => {
        frame = 0;
        if (stopped) return;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo(0, Math.min(y, Math.max(0, max)));
        if (max >= y || performance.now() - started > RESTORE_TIMEOUT_MS) {
            stop();
            return;
        }
        frame = requestAnimationFrame(attempt);
    };
    attempt();
    return stop;
}

function scrollToHash(hash) {
    try {
        const el = document.getElementById(decodeURIComponent(hash.slice(1)));
        if (el) {
            el.scrollIntoView();
            return true;
        }
    } catch { /* malformed hash */ }
    return false;
}

export default function ScrollManager() {
    const location = useLocation();
    const navigationType = useNavigationType();

    // Track the reader's position for the entry they are on.
    useEffect(() => {
        const onScroll = () => {
            if (currentKey) remember(currentKey, Math.round(window.scrollY));
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('pagehide', persist);
        return () => {
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('pagehide', persist);
            persist();
        };
    }, []);

    // Runs after the new page is in the DOM and before it is painted.
    useLayoutEffect(() => {
        currentKey = location.key;
        const isPop = navigationType === 'POP';
        document.documentElement.dataset.nav = isPop ? 'pop' : 'push';

        if (location.hash && scrollToHash(location.hash)) return undefined;

        if (isPop) {
            const saved = positions.get(location.key);
            return saved > 0 ? restoreScroll(saved) : undefined;
        }
        window.scrollTo(0, 0);
        return undefined;
    }, [location.key]);

    return null;
}
