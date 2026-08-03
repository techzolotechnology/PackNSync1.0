import { sendMail, smtpConfigured } from './mailer.js';
import {
    rentalBookingRequestEmail,
    rentalBookingDecisionEmail,
    rideBookingEmail,
} from './emailTemplates.js';

export async function sendBookingConfirmationEmail({ to, subject, html, text }) {
    if (!to) {
        console.log('[DEV] Booking email skipped — user has no email on file.');
        return false;
    }

    if (!smtpConfigured()) {
        console.log(`[DEV] Booking email to ${to}: ${subject}`);
        if (text) console.log(text);
        return false;
    }

    try {
        await sendMail({ to, subject, html, text });
        return true;
    } catch (err) {
        console.error('[ZeptoMail/SMTP booking]', err.message || err);
        return false;
    }
}

/** @deprecated Prefer rentalBookingRequestEmail from emailTemplates — kept for callers that need html only */
export function rentalBookingEmailHtml(opts) {
    return rentalBookingRequestEmail(opts).html;
}

/** @deprecated Prefer rideBookingEmail from emailTemplates */
export function rideBookingEmailHtml(opts) {
    return rideBookingEmail(opts).html;
}

export async function sendRentalBookingRequestMail({ to, subject, ...fields }) {
    const { html, text } = rentalBookingRequestEmail(fields);
    return sendBookingConfirmationEmail({ to, subject, html, text });
}

export async function sendRentalBookingDecisionMail({ to, subject, ...fields }) {
    const { html, text } = rentalBookingDecisionEmail(fields);
    return sendBookingConfirmationEmail({ to, subject, html, text });
}

export async function sendRideBookingMail({ to, subject, ...fields }) {
    const { html, text } = rideBookingEmail(fields);
    return sendBookingConfirmationEmail({ to, subject, html, text });
}
