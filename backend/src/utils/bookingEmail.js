import { Resend } from 'resend';

const resendConfigured = () => {
    const key = process.env.RESEND_API_KEY;
    return Boolean(key && !key.includes('your_resend'));
};

export async function sendBookingConfirmationEmail({ to, subject, html }) {
    if (!to) {
        console.log('[DEV] Booking email skipped — user has no email on file.');
        return false;
    }

    if (!resendConfigured()) {
        console.log(`[DEV] Booking email to ${to}: ${subject}`);
        return false;
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const from = process.env.EMAIL_FROM || 'PackAndSync <onboarding@resend.dev>';

    const { error } = await resend.emails.send({ from, to, subject, html });
    if (error) {
        console.error('[Resend booking]', error);
        return false;
    }
    return true;
}

export function rentalBookingEmailHtml({ renterName, hostName, vehicleLabel, location, startDate, endDate, totalPrice, isHost }) {
    const title = isHost ? 'New rental request on your listing' : 'Your rental booking request was sent';
    const body = isHost
        ? `<p>Hi ${hostName},</p><p><strong>${renterName}</strong> requested your <strong>${vehicleLabel}</strong> in ${location}.</p>`
        : `<p>Hi ${renterName},</p><p>Your booking request for <strong>${vehicleLabel}</strong> in ${location} was sent to the host.</p>`;

    return `
        <h2>PackAndSync — ${title}</h2>
        ${body}
        <ul>
            <li><strong>Dates:</strong> ${startDate} → ${endDate}</li>
            <li><strong>Total:</strong> ₹${totalPrice}</li>
            <li><strong>Status:</strong> Pending host confirmation</li>
        </ul>
        <p>Open PackAndSync → My Bookings to track this request.</p>
    `;
}

export function rideBookingEmailHtml({ userName, provider, vehicleType, pickup, dropoff, fare, currency }) {
    const amount = currency === 'INR' ? `₹${fare}` : `${currency} ${fare}`;
    return `
        <h2>PackAndSync — Ride booking requested</h2>
        <p>Hi ${userName},</p>
        <p>Your ride request has been recorded:</p>
        <ul>
            <li><strong>Provider:</strong> ${provider} ${vehicleType}</li>
            <li><strong>Pickup:</strong> ${pickup}</li>
            <li><strong>Dropoff:</strong> ${dropoff}</li>
            <li><strong>Fare:</strong> ${amount}</li>
        </ul>
        <p>Complete the trip in the provider app if live API booking is unavailable.</p>
    `;
}
