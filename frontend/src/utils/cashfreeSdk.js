/** Load Cashfree's checkout script once and resolve with window.Cashfree. */
export function loadCashfreeSdk() {
    return new Promise((resolve, reject) => {
        if (window.Cashfree) {
            resolve(window.Cashfree);
            return;
        }
        const existing = document.querySelector('script[data-cashfree-sdk]');
        if (existing) {
            existing.addEventListener('load', () => resolve(window.Cashfree));
            existing.addEventListener('error', () => reject(new Error('Cashfree SDK failed to load')));
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
        script.async = true;
        script.dataset.cashfreeSdk = '1';
        script.onload = () => resolve(window.Cashfree);
        script.onerror = () => reject(new Error('Cashfree SDK failed to load'));
        document.body.appendChild(script);
    });
}
