import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { myAvailableDiscounts } from '../utils/offers.js';

/** Offers sent to the signed-in person. */
export const offerRouter = Router();

// GET /api/offers/mine — rental discounts they can still use
offerRouter.get('/mine', authenticate, async (req, res) => {
    res.json({ success: true, data: await myAvailableDiscounts(req.user.id) });
});
