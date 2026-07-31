import { useEffect } from 'react';

/**
 * Scroll-driven reveals + hero parallax for a page subtree.
 *
 * Markup opts in with `ps-reveal` (plus `ps-left` / `ps-right` / `ps-scale`,
 * `ps-image-reveal`, `ps-lift`) and `ps-parallax`. Styles live in motion.css.
 *
 * Nodes that mount later (fetched lists, tab switches) are picked up by a
 * MutationObserver, so a hidden `ps-reveal` can never be left un-revealed.
 */
export default function useGoFlyMotion(rootRef, deps = []) {
    useEffect(() => {
        const root = rootRef.current;
        if (!root) return undefined;

        const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        const reveal = (el) => el.classList.add('is-visible');

        if (reduced || typeof IntersectionObserver === 'undefined') {
            root.querySelectorAll('.ps-reveal').forEach(reveal);
            return undefined;
        }

        const io = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    reveal(entry.target);
                    io.unobserve(entry.target);
                });
            },
            { threshold: 0.12, rootMargin: '0px 0px -7% 0px' },
        );

        const observeAll = () => {
            root.querySelectorAll('.ps-reveal:not(.is-visible)').forEach((el) => io.observe(el));
        };
        observeAll();

        const mo = new MutationObserver(observeAll);
        mo.observe(root, { childList: true, subtree: true });

        let raf = 0;
        const parallax = () => {
            raf = 0;
            root.querySelectorAll('.ps-parallax').forEach((el) => {
                const r = el.getBoundingClientRect();
                const y = Math.max(-26, Math.min(26, (window.innerHeight / 2 - (r.top + r.height / 2)) * 0.055));
                el.style.setProperty('--ps-parallax-y', `${y}px`);
            });
        };
        const onScroll = () => {
            if (!raf) raf = requestAnimationFrame(parallax);
        };

        parallax();
        window.addEventListener('scroll', onScroll, { passive: true });

        return () => {
            io.disconnect();
            mo.disconnect();
            window.removeEventListener('scroll', onScroll);
            if (raf) cancelAnimationFrame(raf);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);
}
