import { WEBSITE_URL } from '../backendConfig';

const CASHFREE_SDK = 'https://sdk.cashfree.com/js/v3/cashfree.js';

// JSON is valid JavaScript; escaping "<" keeps a value from closing the <script> tag.
const scriptValue = (value) => JSON.stringify(String(value)).replace(/</g, '\\u003c');

/**
 * A tiny page that hands the payment session to Cashfree's checkout. The app
 * loads it with pickandsync.com as its origin, the domain Cashfree has approved.
 */
export function checkoutHtml(paymentSessionId, mode) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;background:#eff9ff;color:#0b2744;text-align:center}
.spin{width:38px;height:38px;margin:0 auto 14px;border:4px solid #d8efff;border-top-color:#007bff;border-radius:50%;animation:r .9s linear infinite}
@keyframes r{to{transform:rotate(360deg)}}
p{margin:0 24px;font-size:16px;line-height:1.5}
</style></head>
<body><div><div class="spin" id="spin"></div><p id="msg">Opening secure payment…</p></div>
<script src="${CASHFREE_SDK}"></script>
<script>
(function () {
  function fail(text) {
    document.getElementById('spin').style.display = 'none';
    document.getElementById('msg').textContent = text;
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: text }));
  }
  try {
    Cashfree({ mode: ${scriptValue(mode === 'sandbox' ? 'sandbox' : 'production')} })
      .checkout({ paymentSessionId: ${scriptValue(paymentSessionId)}, redirectTarget: '_self' })
      .then(function (result) { if (result && result.error) fail(result.error.message || 'Payment could not be started.'); });
  } catch (e) {
    fail('Could not load the secure payment page. Check your connection and try again.');
  }
})();
</script></body></html>`;
}

const hostOf = (url) => (/^https?:\/\/([^/?#:]+)/i.exec(url)?.[1] || '').toLowerCase().replace(/^www\./, '');
const pathOf = (url) => (/^https?:\/\/[^/?#]+([^?#]*)/i.exec(url)?.[1] || '/').replace(/\/+$/, '') || '/';
const orderIdOf = (url) => {
  const match = /[?&]order_id=([^&#]+)/.exec(url);
  return match ? decodeURIComponent(match[1]) : null;
};

/**
 * What a page change inside the payment screen means:
 * - done: Cashfree sent the payer back to our site with the order id (the
 *   app return page, or the website wallet page on an older backend);
 * - close: a link back into the app;
 * - external: a UPI app or other non-web link, opened outside the app;
 * - allow: ordinary checkout pages.
 */
export function classifyPaymentUrl(url, site = WEBSITE_URL) {
  const value = String(url || '');
  if (/^packandsync:/i.test(value)) return { action: 'close', orderId: orderIdOf(value) };
  if (/^(about|data|blob|javascript):/i.test(value)) return { action: 'allow' };
  if (!/^https?:/i.test(value)) return { action: 'external' };
  if (hostOf(value) === hostOf(site)) {
    const orderId = orderIdOf(value);
    const path = pathOf(value);
    if (orderId && (path === '/pay/done' || path === '/wallet')) return { action: 'done', orderId };
  }
  return { action: 'allow' };
}

/**
 * Android pages sometimes launch apps with intent://…#Intent;scheme=upi;…;end.
 * Turn that into the app's own link, plus the page to fall back to.
 */
export function parseIntentUrl(url) {
  const match = /^intent:\/\/([^#]*)#Intent;(.*)end;?$/i.exec(String(url || ''));
  if (!match) return null;
  const params = Object.fromEntries(match[2].split(';').filter(Boolean).map((part) => {
    const i = part.indexOf('=');
    return i < 0 ? [part, ''] : [part.slice(0, i), part.slice(i + 1)];
  }));
  return {
    appUrl: params.scheme ? `${params.scheme}://${match[1]}` : null,
    fallbackUrl: params['S.browser_fallback_url'] ? decodeURIComponent(params['S.browser_fallback_url']) : null,
  };
}
