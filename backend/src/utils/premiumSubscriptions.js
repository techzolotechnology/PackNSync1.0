import { prisma } from './prisma.js';
import { notifyUser } from './notify.js';
import { emailConfigured, sendMail } from './mailer.js';
import { premiumSubscriptionReminderEmail } from './emailTemplates.js';

const REMINDER_MS = 48 * 60 * 60 * 1000;
const INDIA_TIME_ZONE = 'Asia/Kolkata';

function formatIndiaDate(value) {
    return new Date(value).toLocaleString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: 'numeric', minute: '2-digit', timeZone: INDIA_TIME_ZONE,
    });
}

/** Idempotent account reminder sent once per paid/trial billing period. */
export async function remindPremiumSubscriptions({ now = new Date(), limit = 200 } = {}) {
    const latestReminderDate = new Date(now.getTime() + REMINDER_MS);
    const subscriptions = await prisma.premiumSubscription.findMany({
        where: {
            status: { in: ['TRIALING', 'ACTIVE'] },
            currentPeriodEndsAt: { gt: now, lte: latestReminderDate },
        },
        include: { user: { select: { id: true, name: true, email: true } } },
        take: limit,
    });

    let reminded = 0;
    for (const subscription of subscriptions) {
        const periodEnd = subscription.currentPeriodEndsAt;
        if (!periodEnd) continue;
        const claimed = await prisma.premiumSubscription.updateMany({
            where: {
                id: subscription.id,
                reminderSentForPeriodEnd: subscription.reminderSentForPeriodEnd,
                currentPeriodEndsAt: periodEnd,
                status: { in: ['TRIALING', 'ACTIVE'] },
            },
            data: { reminderSentForPeriodEnd: periodEnd },
        });
        if (claimed.count !== 1) continue;

        const willRenew = !subscription.cancelAtPeriodEnd;
        const when = formatIndiaDate(periodEnd);
        const monthlyPrice = subscription.monthlyPriceInr;
        const body = willRenew
            ? `Your Premium banner trial or billing period ends on ${when}. It will renew at ₹${monthlyPrice.toLocaleString('en-IN')}/month unless cancelled.`
            : `Your Premium banner access ends on ${when}. Your plan is set not to renew.`;

        await notifyUser({
            userId: subscription.userId,
            type: 'PREMIUM_SUBSCRIPTION',
            title: willRenew ? 'Premium renews in two days' : 'Premium ends in two days',
            body,
            data: { premium: true, periodEndsAt: periodEnd.toISOString(), cancelAtPeriodEnd: subscription.cancelAtPeriodEnd },
        });

        if (subscription.user.email && emailConfigured()) {
            const email = premiumSubscriptionReminderEmail({
                userName: subscription.user.name,
                renewalDate: when,
                monthlyPrice,
                willRenew,
                isTrial: subscription.status === 'TRIALING',
            });
            await sendMail({
                to: subscription.user.email,
                subject: email.subject || (willRenew ? 'Premium banner renewal in two days' : 'Premium banner period ends in two days'),
                html: email.html,
                text: email.text,
            }).catch((error) => console.error('[premium] reminder email failed:', error.message || error));
        }
        reminded += 1;
    }
    return { reminded };
}
