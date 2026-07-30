import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useLocation } from 'react-router-dom';

/**
 * Cinematic route enter/exit. Pass `location` into <Routes location={location}> from App
 * so the exiting page stays frozen while animating out.
 */
export default function PageTransition({ children }) {
    const location = useLocation();
    const reduce = useReducedMotion();

    if (reduce) {
        return <div className="page-transition-root">{children}</div>;
    }

    return (
        <AnimatePresence mode="wait" initial={false}>
            <motion.div
                key={location.pathname}
                className="page-transition-root"
                initial={{ opacity: 0, y: 22, rotateX: 6, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, rotateX: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -14, rotateX: -4, filter: 'blur(4px)' }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                style={{ transformPerspective: 1200, transformOrigin: '50% 0%' }}
            >
                {children}
            </motion.div>
        </AnimatePresence>
    );
}
