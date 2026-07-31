import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const REVEAL_SELECTORS = [
    'main section',
    'main .home-welcome-copy',
    'main .home-welcome-actions',
    'main .home-mod-card',
    'main .home-step',
    'main .home-cta-panel',
    'main .tt-card',
    'main .tt-hero-copy',
    'main .tt-search',
    'main .cr-card',
    'main .cr-hero-inner',
    'main .cr-search',
    'main .cr-cat',
    'main .wallet-header',
    'main .wallet-balance-panel',
    'main .wallet-panel',
    'main .booking-item',
    'main .bookings-header',
    'main .pf-card',
    'main .host-header',
    'main .host-v-card',
    'main .host-b-card',
    'main .admin-room-card',
    'main .admin-topbar',
    'main .verify-hero',
    'main .verify-card',
    'main .create-hero',
    'main .create-card',
    'main .trip-detail-hero',
    'main .trip-panel',
    'main .explore-side > *',
].join(',');

const TILT_SELECTORS = [
    'main .home-mod-card',
    'main .tt-card',
    'main .cr-card',
    'main .wallet-panel',
    'main .wallet-balance-panel',
    'main .host-v-card',
    'main .pf-card',
    'main .admin-room-card',
    'main .home-step',
].join(',');

function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function attachTilt(el) {
    if (el.dataset.psTiltBound === '1') return;
    // Pages that declare their own hover motion keep it
    if (el.classList.contains('ps-lift')) return;
    el.dataset.psTiltBound = '1';
    el.classList.add('ps-tilt');

    const onMove = (e) => {
        const rect = el.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width;
        const py = (e.clientY - rect.top) / rect.height;
        const rx = (0.5 - py) * 10;
        const ry = (px - 0.5) * 12;
        el.style.setProperty('--ps-rx', `${rx.toFixed(2)}deg`);
        el.style.setProperty('--ps-ry', `${ry.toFixed(2)}deg`);
        el.style.setProperty('--ps-gx', `${(px * 100).toFixed(1)}%`);
        el.style.setProperty('--ps-gy', `${(py * 100).toFixed(1)}%`);
        el.classList.add('ps-tilt-active');
    };

    const onLeave = () => {
        el.classList.remove('ps-tilt-active');
        el.style.setProperty('--ps-rx', '0deg');
        el.style.setProperty('--ps-ry', '0deg');
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    el.addEventListener('pointercancel', onLeave);
}

/**
 * Site-wide scroll reveals + 3D tilt on cards (no per-page rewrite needed).
 */
export default function MotionBridge() {
    const { pathname } = useLocation();

    useEffect(() => {
        if (prefersReducedMotion()) return undefined;

        window.scrollTo({ top: 0, left: 0, behavior: 'instant' in window ? 'instant' : 'auto' });

        const root = document.querySelector('main.app-page');
        if (!root) return undefined;

        const revealed = new WeakSet();
        const io = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    const el = entry.target;
                    if (revealed.has(el)) return;
                    revealed.add(el);
                    el.classList.add('ps-reveal-in');
                    io.unobserve(el);
                });
            },
            { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
        );

        const prep = () => {
            root.querySelectorAll(REVEAL_SELECTORS).forEach((el, i) => {
                if (el.dataset.psRevealBound === '1') return;
                // Page declared its own reveal in markup — useGoFlyMotion drives it
                if (el.classList.contains('ps-reveal')) return;
                el.dataset.psRevealBound = '1';
                el.classList.add('ps-reveal');
                el.style.setProperty('--ps-delay', `${Math.min(i % 6, 5) * 55}ms`);

                const rect = el.getBoundingClientRect();
                const inView = rect.top < window.innerHeight * 0.92 && rect.bottom > 0;
                if (inView) {
                    // Stagger first paint slightly without waiting for IO
                    window.requestAnimationFrame(() => el.classList.add('ps-reveal-in'));
                } else {
                    io.observe(el);
                }
            });

            root.querySelectorAll(TILT_SELECTORS).forEach(attachTilt);
        };

        // Run after paint so route content exists
        const t = window.setTimeout(prep, 40);
        const mo = new MutationObserver(() => prep());
        mo.observe(root, { childList: true, subtree: true });

        return () => {
            window.clearTimeout(t);
            io.disconnect();
            mo.disconnect();
        };
    }, [pathname]);

    return null;
}
