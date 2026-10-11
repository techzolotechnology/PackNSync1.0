import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { loadCashfreeSdk } from '../utils/cashfreeSdk.js';
import './PayPage.css';

/**
 * /pay?session=…&mode=production — wallet top-ups started in the mobile app.
 * The app creates the Cashfree order and opens this page in the phone's
 * browser; Cashfree takes over the page and, once paid, returns to /pay/done.
 */
export function PayPage() {
    const [params] = useSearchParams();
    const session = params.get('session');
    const mode = params.get('mode') === 'sandbox' ? 'sandbox' : 'production';
    const [error, setError] = useState(session ? '' : 'This payment link is incomplete. Go back to the PickAndSync app and tap Add money again.');

    useEffect(() => {
        if (!session) return;
        let cancelled = false;
        loadCashfreeSdk()
            .then((Cashfree) => {
                if (cancelled) return;
                return Cashfree({ mode }).checkout({ paymentSessionId: session, redirectTarget: '_self' });
            })
            .then((result) => {
                if (!cancelled && result?.error) setError(result.error.message || 'Payment could not be started.');
            })
            .catch(() => {
                if (!cancelled) setError('Could not load the secure payment page. Check your connection and try again.');
            });
        return () => { cancelled = true; };
    }, [session, mode]);

    return (
        <div className="pay-page">
            <div className="pay-card" role="status" aria-live="polite">
                {error ? (
                    <>
                        <h1>Payment didn’t start</h1>
                        <p>{error}</p>
                        <a className="btn btn-primary" href="packandsync://wallet">Back to the app</a>
                    </>
                ) : (
                    <>
                        <div className="pay-spinner" aria-hidden="true" />
                        <h1>Opening secure payment…</h1>
                        <p>You’ll pay through Cashfree. Don’t close this page.</p>
                    </>
                )}
            </div>
        </div>
    );
}

/** /pay/done?order_id=… — where Cashfree returns after an app top-up. */
export function PayDonePage() {
    const [params] = useSearchParams();
    const orderId = params.get('order_id');
    const appLink = `packandsync://wallet${orderId ? `?order_id=${encodeURIComponent(orderId)}` : ''}`;

    useEffect(() => {
        // Hand straight back to the app where it is installed; the buttons stay as a fallback.
        const t = setTimeout(() => { window.location.href = appLink; }, 600);
        return () => clearTimeout(t);
    }, [appLink]);

    return (
        <div className="pay-page">
            <div className="pay-card" role="status">
                <h1>Payment submitted</h1>
                <p>Go back to the PickAndSync app. Your wallet updates as soon as Cashfree confirms the payment, usually within a minute.</p>
                <a className="btn btn-primary" href={appLink}>Open the PickAndSync app</a>
                <Link className="btn btn-ghost" to="/wallet">Open my wallet on the website</Link>
            </div>
        </div>
    );
}

export default PayPage;
