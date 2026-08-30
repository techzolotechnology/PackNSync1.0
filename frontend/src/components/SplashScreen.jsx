// SplashScreen.jsx — boot splash on brand blue.
// Dismisses once both: minMs elapsed (default 2000) AND ready === true. 400ms fade.
// Usage in App.jsx:
//   const [booted, setBooted] = useState(false);
//   {!booted && <SplashScreen onDone={() => setBooted(true)} />}
import { useEffect, useState } from 'react';
import AnimatedLogo from './AnimatedLogo';
import './SplashScreen.css';

export default function SplashScreen({ ready = true, minMs = 2000, onDone }) {
    const [minPassed, setMinPassed] = useState(false);
    const [fading, setFading] = useState(false);
    const [gone, setGone] = useState(false);
    useEffect(() => {
        const t = setTimeout(() => setMinPassed(true), minMs);
        return () => clearTimeout(t);
    }, [minMs]);
    useEffect(() => {
        if (ready && minPassed && !fading) {
            setFading(true);
            const t = setTimeout(() => { setGone(true); onDone && onDone(); }, 400);
            return () => clearTimeout(t);
        }
    }, [ready, minPassed, fading, onDone]);
    if (gone) return null;
    return (
        <div className={'pns-splash' + (fading ? ' pns-splash-fade' : '')}>
            <AnimatedLogo size={200} showWordmark />
        </div>
    );
}
