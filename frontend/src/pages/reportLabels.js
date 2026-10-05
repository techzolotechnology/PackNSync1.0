/** Display text for report categories and statuses (keys match the API). */
export const REPORT_CATEGORY_LABELS = {
    SAFETY: 'Safety concern',
    HARASSMENT: 'Harassment or abuse',
    FRAUD: 'Scam or fraud',
    VEHICLE_DAMAGE: 'Vehicle damage',
    PAYMENT: 'Payment or refund problem',
    LISTING_INACCURATE: 'Listing not as described',
    OTHER: 'Something else',
};

export const REPORT_CATEGORY_HINTS = {
    SAFETY: 'Someone felt unsafe, or a vehicle was unsafe to drive',
    HARASSMENT: 'Threats, insults or unwanted contact',
    FRAUD: 'Fake listing, asked to pay outside the app, impersonation',
    VEHICLE_DAMAGE: 'Damage to a car or bike during a rental',
    PAYMENT: 'Charged wrongly, refund missing, wallet issue',
    LISTING_INACCURATE: 'Car, features or location different from the listing',
    OTHER: 'Anything else we should know',
};

export const REPORT_STATUS_LABELS = {
    OPEN: 'Received',
    IN_REVIEW: 'Being reviewed',
    RESOLVED: 'Resolved',
    DISMISSED: 'Closed',
};
