import { sendMail, smtpConfigured } from './mailer.js';

export async function sendBookingConfirmationEmail({ to, subject, html }) {
    if (!to) {
        console.log('[DEV] Booking email skipped — user has no email on file.');
        return false;
    }

    if (!smtpConfigured()) {
        console.log(`[DEV] Booking email to ${to}: ${subject}`);
        return false;
    }

    try {
        await sendMail({ to, subject, html });
        return true;
    } catch (err) {
        console.error('[ZeptoMail/SMTP booking]', err.message || err);
        return false;
    }
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
