import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminApi, pricingApi } from '../../api/index.js';

export default function AdminPremiumBannerPricing() {
    const [price, setPrice] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let active = true;
        pricingApi.getPremiumBanner().then((res) => {
            if (active) setPrice(String(res.data.data.price));
        }).catch(() => toast.error('Could not load premium banner pricing.'));
        return () => { active = false; };
    }, []);

    const save = async (event) => {
        event.preventDefault();
        const value = Number(price);
        if (!Number.isInteger(value) || value < 1 || value > 1_000_000) {
            toast.error('Enter a whole-number price between ₹1 and ₹10,00,000.');
            return;
        }
        setSaving(true);
        try {
            const res = await adminApi.updatePremiumBannerPrice(value);
            setPrice(String(res.data.data.price));
            toast.success('Premium banner price updated across the website and app.');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not update premium banner pricing.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className="admin-premium-pricing" aria-labelledby="premium-banner-pricing-title">
            <div>
                <h3 id="premium-banner-pricing-title">Premium banner price</h3>
                <p>One monthly subscription price is shown for each premium banner across the website and customer app. Price changes apply to new signups; existing subscriptions keep the amount the customer authorised.</p>
            </div>
            <form onSubmit={save}>
                <label htmlFor="premium-banner-price">Monthly price per banner (₹)</label>
                <input
                    id="premium-banner-price"
                    className="form-input"
                    type="number"
                    min="1"
                    max="1000000"
                    step="1"
                    required
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    aria-describedby="premium-banner-price-help"
                />
                <small id="premium-banner-price-help">The first 30 days cost ₹5. Whole rupees, from ₹1 to ₹10,00,000 after the trial.</small>
                <button className="btn btn-primary" type="submit" disabled={saving || !price}>
                    {saving ? 'Saving…' : 'Save price'}
                </button>
            </form>
        </section>
    );
}
