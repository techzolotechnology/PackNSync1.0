// AnimatedLogo.jsx — PickAndSync animated pin mark (13s seamless loop).
// Zero dependencies beyond React. Pin splits, halves orbit, snap together,
// gold dot pops, wordmark tracking settles.
import { useEffect, useId, useRef, useState } from 'react';

const TOTAL = 13;
const CUES = { Breathe: 0, Split: 2.5, Orbit: 5, Snap: 8.5, Reveal: 10.5 };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const easeInOutCubic = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3);
const easeOutBack = (p) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };
const anim = (from, to, start, end, ease) => (T) => { const p = clamp((T - start) / (end - start), 0, 1); return from + (to - from) * ease(p); };
const PIN = 'M80 44c-16.6 0-30 13.4-30 30 0 22.4 30 54 30 54s30-31.6 30-54c0-16.6-13.4-30-30-30z';

export default function AnimatedLogo({ size = 240, showWordmark = false }) {
    const [T, setT] = useState(0);
    const t0 = useRef(null);
    const instanceId = useId().replace(/:/g, '');
    const leftClipId = `pns-clip-l-${instanceId}`;
    const rightClipId = `pns-clip-r-${instanceId}`;
    useEffect(() => {
        let raf;
        const tick = (now) => {
            if (t0.current == null) t0.current = now;
            setT(((now - t0.current) / 1000) % TOTAL);
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, []);

    const R = 55;
    const sep = T < CUES.Snap
        ? anim(0, R, CUES.Split + 0.4, CUES.Split + 2.2, easeInOutCubic)(T)
        : anim(R, 0, CUES.Snap, CUES.Snap + 1.3, easeOutBack)(T);
    const ang = anim(0, 360, CUES.Orbit - 0.2, CUES.Snap + 1.1, easeInOutCubic)(T) * Math.PI / 180;
    const dx = sep * Math.cos(ang), dy = sep * Math.sin(ang) * 0.45;
    const rot = 360 * T / TOTAL;
    const dotK = T < CUES.Orbit
        ? anim(1, 0, CUES.Split + 0.2, CUES.Split + 1.0, easeInOutCubic)(T)
        : anim(0, 1, CUES.Snap + 1.1, CUES.Snap + 1.7, easeOutBack)(T);
    const pulse = T < CUES.Snap + 1.3 ? 1 : anim(1.06, 1, CUES.Snap + 1.3, CUES.Snap + 2.0, easeOutCubic)(T);
    const ringP = anim(0, 1, CUES.Snap + 1.3, CUES.Reveal + 0.6, easeOutCubic)(T);
    const ringO = T > CUES.Snap + 1.3 && ringP < 1 ? (1 - ringP) * 0.4 : 0;
    const wmO = T < CUES.Orbit
        ? anim(1, 0, CUES.Split, CUES.Split + 0.9, easeInOutCubic)(T)
        : anim(0, 1, CUES.Reveal, CUES.Reveal + 1.2, easeOutCubic)(T);
    const wmTrack = T < CUES.Orbit ? -0.02 : anim(0.3, -0.02, CUES.Reveal, CUES.Reveal + 1.8, easeOutCubic)(T);
    const tgO = T < CUES.Orbit
        ? anim(1, 0, CUES.Split + 0.2, CUES.Split + 1.1, easeInOutCubic)(T)
        : anim(0, 1, CUES.Reveal + 0.6, CUES.Reveal + 1.8, easeOutCubic)(T);
    const tgTrack = T < CUES.Orbit ? 0.12 : anim(0.34, 0.12, CUES.Reveal + 0.6, CUES.Reveal + 2.2, easeOutCubic)(T);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: size * 0.155 }}>
            <svg width={size} height={size} viewBox="0 0 160 160" style={{ overflow: 'visible' }} aria-label="PickAndSync">
                <defs>
                    <clipPath id={leftClipId}><rect x="-10" y="0" width="90" height="170" /></clipPath>
                    <clipPath id={rightClipId}><rect x="80" y="0" width="90" height="170" /></clipPath>
                </defs>
                <circle cx="80" cy="80" r={62 + ringP * 18} fill="none" stroke="#fff" strokeWidth="3" opacity={ringO} />
                <g opacity="0.5" transform={`rotate(${rot} 80 80)`}>
                    <path d="M 90.77 18.94 A 62 62 0 1 1 26.31 49" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
                    <polygon points="80,9 96,18 80,27" fill="#fff" />
                </g>
                <g transform={`translate(80 80) scale(${pulse}) translate(-80 -80)`}>
                    <g transform={`translate(${-dx} ${-dy})`}><path d={PIN} fill="#fff" clipPath={`url(#${leftClipId})`} /></g>
                    <g transform={`translate(${dx} ${dy})`}><path d={PIN} fill="#fff" clipPath={`url(#${rightClipId})`} /></g>
                    <g transform={`translate(80 74) scale(${dotK})`}><circle r="13" fill="#f5b800" /></g>
                </g>
            </svg>
            {showWordmark && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: size * 0.05 }}>
                    <div style={{ color: '#fff', fontWeight: 800, fontSize: size * 0.26, lineHeight: 1, letterSpacing: wmTrack + 'em', marginRight: wmTrack + 'em', opacity: wmO, fontFamily: 'var(--font-display, Manrope, sans-serif)' }}>PickAndSync</div>
                    <div style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 500, fontSize: size * 0.083, letterSpacing: tgTrack + 'em', marginRight: tgTrack + 'em', opacity: tgO, fontFamily: 'var(--font-sans, Manrope, sans-serif)' }}>Pack up. Sync up. Go.</div>
                </div>
            )}
        </div>
    );
}
