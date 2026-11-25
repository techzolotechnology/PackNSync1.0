import { prisma } from './prisma.js';

export const DEFAULT_PREMIUM_BANNER_PRICE = 499;
export const PREMIUM_TRIAL_PRICE = 5;
export const PREMIUM_TRIAL_DAYS = 30;
const PRICE_KEY = 'premium_banner_price_inr';

export async function getPremiumBannerPricing() {
    const setting = await prisma.appSetting.upsert({
        where: { key: PRICE_KEY },
        update: {},
        create: { key: PRICE_KEY, value: String(DEFAULT_PREMIUM_BANNER_PRICE) },
    });
    return {
        price: Number(setting.value),
        monthlyPrice: Number(setting.value),
        trialPrice: PREMIUM_TRIAL_PRICE,
        trialDays: PREMIUM_TRIAL_DAYS,
        billingInterval: 'month',
        currency: 'INR',
        updatedAt: setting.updatedAt,
    };
}

export async function setPremiumBannerPrice(price) {
    const setting = await prisma.appSetting.upsert({
        where: { key: PRICE_KEY },
        update: { value: String(price) },
        create: { key: PRICE_KEY, value: String(price) },
    });
    return {
        price: Number(setting.value),
        monthlyPrice: Number(setting.value),
        trialPrice: PREMIUM_TRIAL_PRICE,
        trialDays: PREMIUM_TRIAL_DAYS,
        billingInterval: 'month',
        currency: 'INR',
        updatedAt: setting.updatedAt,
    };
}
