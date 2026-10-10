import { useLocation } from 'react-router-dom';

/**
 * Route entrance. The new page replaces the old one in the same frame and
 * fades in (motion.css). There is no exit animation and no transform or blur:
 * holding the old page while it animated out made the content area collapse
 * and grow again on every navigation. Opacity never moves the layout, and
 * Back/Forward skip the fade entirely (html[data-nav="pop"]).
 */
export default function PageTransition({ children }) {
    const { pathname } = useLocation();
    return (
        <div key={pathname} className="page-transition-root">
            {children}
        </div>
    );
}
