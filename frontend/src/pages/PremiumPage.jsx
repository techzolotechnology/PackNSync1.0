import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { premiumSubscriptionApi } from '../api/index.js';
import { loadCashfreeSdk } from '../utils/cashfreeSdk.js';
import { useAuthStore } from '../store/authStore.js';
import './PremiumPage.css';

function formatDate(value) {
    if (!value) return '—';
    return new Date(value).toLocaleString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata',
    });
}

const STATUS_LABELS = {
    PENDING: 'Payment authorisation pending', TRIALING: '30-day trial active', ACTIVE: 'Premium active',
    PAST_DUE: 'Payment needs attention', CANCELLED: 'Cancellation scheduled', EXPIRED: 'Premium ended',
};

export default function PremiumPage() {
    const [params, setParams] = useSearchParams();
    const setUser = useAuthStore((state) => state.setUser);
    const [state, setState] = useState(null);
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        const response = await premiumSubscriptionApi.getMine();
        const data = response.data?.data || null;
        setState(data);
        const currentUser = useAuthStore.getState().user;
        if (currentUser && data && currentUser.isPremium !== data.isPremium) {
            setUser({ ...currentUser, isPremium: data.isPremium, premiumFeatures: data.premiumFeatures });
        }
    }, [setUser]);

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                if (params.get('cashfree') === 'return') {
                    await premiumSubscriptionApi.confirmCashfreeCheckout();
                    const next = new URLSearchParams(params);
                    next.delete('cashfree');
                    setParams(next, { replace: true });
                }
                const response = await premiumSubscriptionApi.getMine();
                if (active) {
                    const data = response.data?.data || null;
                    setState(data);
                    const currentUser = useAuthStore.getState().user;
                    if (currentUser && data && currentUser.isPremium !== data.isPremium) {
                        setUser({ ...currentUser, isPremium: data.isPremium, premiumFeatures: data.premiumFeatures });
                    }
                }
            } catch (error) {
                if (active) toast.error(error.response?.data?.message || 'Could not load Premium details.');
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, [params, setParams, setUser]);

    const beginCheckout = async () => {
        setBusy(true);
        try {
            const response = await premiumSubscriptionApi.startCashfreeCheckout();
            const session = response.data?.data;
            if (!session?.subscriptionSessionId) throw new Error('Cashfree did not return a checkout session.');
            const Cashfree = await loadCashfreeSdk();
            const checkout = Cashfree({ mode: session.environment === 'production' ? 'production' : 'sandbox' });
            const result = await checkout.subscriptionsCheckout({ subsSessionId: session.subscriptionSessionId, redirectTarget: '_self' });
            if (result?.error) throw new Error(result.error.message || 'Cashfree checkout could not open.');
        } catch (error) {
            toast.error(error.response?.data?.message || error.message || 'Could not start Premium checkout.');
            await refresh().catch(() => {});
        } finally {
            setBusy(false);
        }
    };

    const cancel = async () => {
        if (!window.confirm('Cancel Premium renewal? Your current access will remain available until its end date.')) return;
        setBusy(true);
        try {
            await premiumSubscriptionApi.cancel();
            await refresh();
            toast.success('Premium renewal cancelled.');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not cancel Premium.');
        } finally {
            setBusy(false);
        }
    };

    const subscription = state?.subscription;
    const offer = state?.offer;
    const periodStillActive = subscription?.currentPeriodEndsAt && new Date(subscription.currentPeriodEndsAt) > new Date();
    const canStart = offer?.enabled && (!subscription || subscription.status === 'EXPIRED' || (subscription.status === 'CANCELLED' && (!subscription.trialStartedAt || !periodStillActive)));
    const canCancel = subscription && ['PENDING', 'TRIALING', 'ACTIVE', 'PAST_DUE'].includes(subscription.status) && !subscription.cancelAtPeriodEnd;

    return (
        <section className="premium-page">
            <Link className="premium-back" to="/">← Back to PickAndSync</Link>
            <div className="premium-card">
                <p className="premium-kicker">PICKANDSYNC PREMIUM PLACEMENT</p>
                <h1>Put your trip or rental offer in front of more travelers.</h1>
                <p className="premium-intro">Feature one banner on PickAndSync. Review the recurring price and authorise the mandate before the trial starts.</p>
                <ul className="premium-benefits">
                    <li>Premium badge on your profile avatar</li>
                    <li>Ad-free PickAndSync experience</li>
                    <li>Premium placement for one travel or rental banner</li>
                </ul>
                <div className="premium-offer" aria-label="Premium subscription offer">
                    <div><span>First 30 days</span><strong>₹{offer?.trialPrice ?? 5}</strong></div>
                    <div><span>Then, per banner</span><strong>₹{Number(offer?.monthlyPrice ?? 499).toLocaleString('en-IN')}<small>/month</small></strong></div>
                </div>
                <p className="premium-terms">Recurring monthly billing starts after the 30-day trial at the monthly price shown above. It renews until you cancel. You can cancel from this page. Cashfree will display and collect mandate authorisation details at checkout.</p>

                {loading && <p className="premium-state">Loading your subscription…</p>}
                {subscription && !loading && (
                    <div className="premium-current" role="status">
                        <strong>{STATUS_LABELS[subscription.status] || subscription.status}</strong>
                        {subscription.status === 'TRIALING'
                            ? <p>Trial ends: {formatDate(subscription.trialEndsAt)}. Next billing: ₹{Number(subscription.monthlyPriceInr).toLocaleString('en-IN')}/month.</p>
                            : <p>Current access ends: {formatDate(subscription.currentPeriodEndsAt)}.</p>}
                        {subscription.cancelAtPeriodEnd && <p>Renewal is off. Premium access remains through the current period.</p>}
                    </div>
                )}
                {!loading && state?.isPremium && <Link className="premium-action premium-continue" to="/trips">Continue to PickAndSync</Link>}
                {!loading && canStart && <button className="premium-action" type="button" onClick={beginCheckout} disabled={busy}>{busy ? 'Opening secure checkout…' : 'Start 30-day trial for ₹5'}</button>}
                {!loading && subscription?.status === 'PENDING' && !canStart && <button className="premium-action" type="button" onClick={beginCheckout} disabled={busy}>{busy ? 'Opening secure checkout…' : 'Continue authorisation'}</button>}
                {!loading && canCancel && <button className="premium-cancel" type="button" onClick={cancel} disabled={busy}>Cancel renewal</button>}
                {!loading && !offer?.enabled && !subscription && <p className="premium-unavailable">Premium subscriptions are not available yet. Please check back later.</p>}
                <p className="premium-help">Questions? <a href="mailto:support@pickandsync.com">Contact PickAndSync support</a>.</p>
            </div>
        </section>
    );
}
