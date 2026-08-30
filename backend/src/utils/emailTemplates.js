/**
 * PickAndSync branded email templates.
 * Inline styles + table layout for Gmail / Outlook / ZeptoMail.
 */

const BRAND = {
    name: 'PickAndSync',
    navy: '#292966',
    slate: '#5c5c99',
    mist: '#a3a3cc',
    wash: '#f4f4ff',
    white: '#ffffff',
    legal: 'TECHZOLO TECHNOLOGIES LLP',
    site: (process.env.FRONTEND_URL || 'https://pickandsync.com').replace(/\/$/, ''),
    support: 'hello@packandsync.com',
};

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Shared shell: lavender wash, navy brand, CTA, legal footer.
 * @returns {{ html: string, text: string }}
 */
export function wrapEmail({
    preheader = '',
    title,
    bodyHtml,
    bodyText,
    ctaLabel,
    ctaUrl,
}) {
    const site = BRAND.site;
    const btnUrl = ctaUrl || site;
    const btnLabel = ctaLabel || 'Open PickAndSync';
    const safeTitle = escapeHtml(title);
    const safePre = escapeHtml(preheader);

    const ctaBlock = `
      <tr>
        <td style="padding:8px 0 28px;">
          <a href="${escapeHtml(btnUrl)}"
             style="display:inline-block;background:${BRAND.navy};color:${BRAND.white};text-decoration:none;
                    font-weight:700;font-size:15px;padding:14px 28px;border-radius:999px;">
            ${escapeHtml(btnLabel)}
          </a>
        </td>
      </tr>`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.wash};color:${BRAND.navy};
             font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${safePre}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BRAND.wash};padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
               style="max-width:560px;background:${BRAND.white};border-radius:16px;
                      border:1px solid rgba(163,163,204,0.45);overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,${BRAND.navy} 0%,${BRAND.slate} 100%);
                       padding:22px 28px;">
              <p style="margin:0;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;
                        color:rgba(255,255,255,0.8);font-weight:700;">${BRAND.name}</p>
              <h1 style="margin:8px 0 0;font-size:22px;line-height:1.25;color:${BRAND.white};
                         font-weight:700;">${safeTitle}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px;font-size:15px;line-height:1.6;color:${BRAND.navy};">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px;">
              <table role="presentation" cellspacing="0" cellpadding="0">${ctaBlock}</table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 24px;border-top:1px solid rgba(163,163,204,0.35);
                       font-size:12px;line-height:1.55;color:${BRAND.slate};">
              A product of <strong style="color:${BRAND.navy};">${BRAND.legal}</strong><br />
              <a href="${escapeHtml(site)}" style="color:${BRAND.slate};">${escapeHtml(site.replace(/^https?:\/\//, ''))}</a>
              · <a href="mailto:${BRAND.support}" style="color:${BRAND.slate};">${BRAND.support}</a>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;font-size:11px;color:${BRAND.mist};max-width:560px;">
          You received this because you use ${BRAND.name}. If you did not expect it, you can ignore this email.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const text = [
        `${BRAND.name} — ${title}`,
        '',
        bodyText,
        '',
        `${btnLabel}: ${btnUrl}`,
        '',
        `A product of ${BRAND.legal}`,
        site,
        BRAND.support,
    ].join('\n');

    return { html, text };
}

export function otpEmail({ otpCode, minutes = 10 }) {
    const code = escapeHtml(otpCode);
    return wrapEmail({
        preheader: `Your PickAndSync code is ${otpCode}`,
        title: 'Your verification code',
        ctaLabel: 'Open PickAndSync',
        ctaUrl: BRAND.site,
        bodyHtml: `
          <p style="margin:0 0 16px;">Use this one-time code to sign in. It expires in <strong>${minutes} minutes</strong>.</p>
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;
                    color:${BRAND.slate};font-weight:700;">Code</p>
          <p style="margin:0 0 20px;font-size:32px;font-weight:800;letter-spacing:0.28em;
                    color:${BRAND.navy};font-family:Consolas,Monaco,monospace;">${code}</p>
          <p style="margin:0;color:${BRAND.slate};font-size:14px;">Do not share this code with anyone. PickAndSync will never ask for it by phone.</p>
        `,
        bodyText: `Your PickAndSync verification code is ${otpCode}. It expires in ${minutes} minutes. Do not share it with anyone.`,
    });
}

export function rentalBookingRequestEmail({
    renterName,
    hostName,
    vehicleLabel,
    location,
    startDate,
    endDate,
    totalPrice,
    isHost,
}) {
    const title = isHost ? 'New rental request' : 'Booking request sent';
    const greeting = isHost ? hostName : renterName;
    const lead = isHost
        ? `<strong>${escapeHtml(renterName)}</strong> requested your <strong>${escapeHtml(vehicleLabel)}</strong> in ${escapeHtml(location)}.`
        : `Your request for <strong>${escapeHtml(vehicleLabel)}</strong> in ${escapeHtml(location)} was sent to the host.`;

    const rows = [
        ['Dates', `${startDate} → ${endDate}`],
        ['Total', `₹${Number(totalPrice).toLocaleString('en-IN')}`],
        ['Status', 'Pending host confirmation'],
    ];

    const details = rows.map(([k, v]) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid rgba(163,163,204,0.35);color:${BRAND.slate};width:34%;">${escapeHtml(k)}</td>
        <td style="padding:8px 0;border-bottom:1px solid rgba(163,163,204,0.35);font-weight:600;">${escapeHtml(v)}</td>
      </tr>`).join('');

    return wrapEmail({
        preheader: isHost
            ? `${renterName} requested ${vehicleLabel}`
            : `Request sent for ${vehicleLabel}`,
        title,
        ctaLabel: isHost ? 'Review booking' : 'My Bookings',
        ctaUrl: `${BRAND.site}/bookings`,
        bodyHtml: `
          <p style="margin:0 0 14px;">Hi ${escapeHtml(greeting || 'there')},</p>
          <p style="margin:0 0 18px;">${lead}</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:14px;">${details}</table>
        `,
        bodyText: [
            `Hi ${greeting || 'there'},`,
            '',
            isHost
                ? `${renterName} requested your ${vehicleLabel} in ${location}.`
                : `Your request for ${vehicleLabel} in ${location} was sent to the host.`,
            `Dates: ${startDate} → ${endDate}`,
            `Total: ₹${Number(totalPrice).toLocaleString('en-IN')}`,
            'Status: Pending host confirmation',
        ].join('\n'),
    });
}

export function rentalBookingDecisionEmail({
    renterName,
    vehicleLabel,
    location,
    startDate,
    endDate,
    totalPrice,
    confirmed,
}) {
    const title = confirmed ? 'Booking confirmed' : 'Booking declined';
    const lead = confirmed
        ? `Good news — the host confirmed your booking for <strong>${escapeHtml(vehicleLabel)}</strong>. You can pay from My Bookings.`
        : `The host declined your request for <strong>${escapeHtml(vehicleLabel)}</strong>. You can browse other cars anytime.`;

    return wrapEmail({
        preheader: confirmed
            ? `${vehicleLabel} is confirmed`
            : `${vehicleLabel} was declined`,
        title,
        ctaLabel: confirmed ? 'Pay in My Bookings' : 'Browse cars',
        ctaUrl: confirmed ? `${BRAND.site}/bookings` : `${BRAND.site}/rentals`,
        bodyHtml: `
          <p style="margin:0 0 14px;">Hi ${escapeHtml(renterName || 'there')},</p>
          <p style="margin:0 0 18px;">${lead}</p>
          <p style="margin:0;color:${BRAND.slate};font-size:14px;">
            ${escapeHtml(location)} · ${escapeHtml(startDate)} → ${escapeHtml(endDate)}
            ${totalPrice != null ? ` · ₹${Number(totalPrice).toLocaleString('en-IN')}` : ''}
          </p>
        `,
        bodyText: [
            `Hi ${renterName || 'there'},`,
            '',
            confirmed
                ? `The host confirmed your booking for ${vehicleLabel}. Pay from My Bookings.`
                : `The host declined your request for ${vehicleLabel}.`,
            `${location} · ${startDate} → ${endDate}${totalPrice != null ? ` · ₹${Number(totalPrice).toLocaleString('en-IN')}` : ''}`,
        ].join('\n'),
    });
}

export function rideBookingEmail({ userName, provider, vehicleType, pickup, dropoff, fare, currency }) {
    const amount = currency === 'INR' || !currency
        ? `₹${Number(fare).toLocaleString('en-IN')}`
        : `${currency} ${fare}`;

    return wrapEmail({
        preheader: `Ride request — ${provider}`,
        title: 'Ride booking requested',
        ctaLabel: 'Open PickAndSync',
        ctaUrl: BRAND.site,
        bodyHtml: `
          <p style="margin:0 0 14px;">Hi ${escapeHtml(userName || 'there')},</p>
          <p style="margin:0 0 14px;">Your ride request has been recorded:</p>
          <ul style="margin:0;padding-left:18px;color:${BRAND.navy};">
            <li><strong>Provider:</strong> ${escapeHtml(provider)} ${escapeHtml(vehicleType || '')}</li>
            <li><strong>Pickup:</strong> ${escapeHtml(pickup)}</li>
            <li><strong>Dropoff:</strong> ${escapeHtml(dropoff)}</li>
            <li><strong>Fare:</strong> ${escapeHtml(amount)}</li>
          </ul>
        `,
        bodyText: [
            `Hi ${userName || 'there'},`,
            '',
            'Your ride request has been recorded:',
            `Provider: ${provider} ${vehicleType || ''}`,
            `Pickup: ${pickup}`,
            `Dropoff: ${dropoff}`,
            `Fare: ${amount}`,
        ].join('\n'),
    });
}

export function walletTopupEmail({ userName, amount, balance, orderId }) {
    return wrapEmail({
        preheader: `₹${Number(amount).toLocaleString('en-IN')} added to your wallet`,
        title: 'Wallet topped up',
        ctaLabel: 'Open Wallet',
        ctaUrl: `${BRAND.site}/wallet`,
        bodyHtml: `
          <p style="margin:0 0 14px;">Hi ${escapeHtml(userName || 'there')},</p>
          <p style="margin:0 0 18px;">
            <strong>₹${escapeHtml(Number(amount).toLocaleString('en-IN'))}</strong> was added to your PickAndSync wallet.
          </p>
          <p style="margin:0;color:${BRAND.slate};font-size:14px;">
            Available balance: <strong style="color:${BRAND.navy};">₹${escapeHtml(Number(balance).toLocaleString('en-IN'))}</strong>
            ${orderId ? `<br />Reference: ${escapeHtml(orderId)}` : ''}
          </p>
        `,
        bodyText: [
            `Hi ${userName || 'there'},`,
            '',
            `₹${Number(amount).toLocaleString('en-IN')} was added to your PickAndSync wallet.`,
            `Available balance: ₹${Number(balance).toLocaleString('en-IN')}`,
            orderId ? `Reference: ${orderId}` : '',
        ].filter(Boolean).join('\n'),
    });
}
