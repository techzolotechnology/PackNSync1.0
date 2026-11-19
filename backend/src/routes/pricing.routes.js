import { Router } from 'express';
import { getPremiumBannerPricing } from '../utils/premiumBannerPricing.js';

export const pricingRouter = Router();

pricingRouter.get('/premium-banner', async (_req, res) => {
    res.json({ success: true, data: await getPremiumBannerPricing() });
});
