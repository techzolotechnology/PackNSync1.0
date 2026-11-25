const ACCESS_STATUSES = new Set(['TRIALING', 'ACTIVE', 'CANCELLED']);

export function premiumAccess(subscription, now = new Date()) {
    const end = subscription?.currentPeriodEndsAt ? new Date(subscription.currentPeriodEndsAt) : null;
    const isPremium = Boolean(
        subscription
        && ACCESS_STATUSES.has(subscription.status)
        && end
        && Number.isFinite(end.getTime())
        && end > now,
    );

    return {
        isPremium,
        premiumFeatures: {
            adFree: isPremium,
            profileBadge: isPremium,
            premiumBannerPlacement: isPremium,
        },
    };
}
