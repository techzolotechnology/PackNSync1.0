/** Compact INR for tight UI (navbar); full amounts use locale formatting. */
export function formatInrCompact(amount) {
    const n = Number(amount);
    if (!Number.isFinite(n)) return '₹—';
    const abs = Math.abs(n);
    const sign = n < 0 ? '−' : '';
    if (abs >= 100000) {
        const lakhs = abs / 100000;
        const s = lakhs >= 10 ? lakhs.toFixed(0) : lakhs.toFixed(1).replace(/\.0$/, '');
        return `${sign}₹${s}L`;
    }
    if (abs >= 1000) {
        const k = abs / 1000;
        const s = k >= 10 ? k.toFixed(0) : k.toFixed(1).replace(/\.0$/, '');
        return `${sign}₹${s}k`;
    }
    return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`;
}

export function formatInr(amount) {
    const n = Number(amount);
    if (!Number.isFinite(n)) return '₹—';
    return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}
