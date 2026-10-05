import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';

/**
 * RFC 6238 time-based one-time passwords — what Google Authenticator,
 * Microsoft Authenticator, Authy etc. generate. SHA-1, 6 digits, 30 s steps.
 */
const STEP_SECONDS = 30;
const DIGITS = 6;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buffer) {
    let bits = 0;
    let value = 0;
    let out = '';
    for (const byte of buffer) {
        value = (value << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            out += ALPHABET[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
    return out;
}

export function base32Decode(input) {
    const clean = String(input).toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
    let bits = 0;
    let value = 0;
    const out = [];
    for (const char of clean) {
        const idx = ALPHABET.indexOf(char);
        if (idx === -1) throw new Error('Invalid base32 secret');
        value = (value << 5) | idx;
        bits += 5;
        if (bits >= 8) {
            out.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }
    return Buffer.from(out);
}

/** New 160-bit secret, base32 encoded (what authenticator apps expect). */
export const generateTotpSecret = () => base32Encode(randomBytes(20));

export const currentStep = (now = Date.now()) => Math.floor(now / 1000 / STEP_SECONDS);

export function totpAt(secret, step) {
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(step));
    const hmac = createHmac('sha1', base32Decode(secret)).update(counter).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITS;
    return String(code).padStart(DIGITS, '0');
}

/**
 * Check a code against the current step ±1 (clock drift). Returns the
 * matching step, or null. Steps at or before `lastStep` are rejected so a
 * code can only be used once.
 */
export function verifyTotp(secret, code, { lastStep = null, now = Date.now() } = {}) {
    const clean = String(code || '').replace(/\s/g, '');
    if (!/^\d{6}$/.test(clean)) return null;
    const step = currentStep(now);
    for (const candidate of [step - 1, step, step + 1]) {
        if (lastStep !== null && candidate <= lastStep) continue;
        const expected = Buffer.from(totpAt(secret, candidate));
        if (timingSafeEqual(expected, Buffer.from(clean))) return candidate;
    }
    return null;
}

export function otpauthUrl(secret, accountName, issuer = 'PickAndSync Admin') {
    const label = encodeURIComponent(`${issuer}:${accountName}`);
    return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}

/* ---------- backup codes ---------- */

const hashCode = (code) => createHash('sha256').update(String(code).toUpperCase().replace(/[^A-Z0-9]/g, '')).digest('hex');

/** Ten one-time recovery codes like "K7Q2M-9XWPD". Store only the hashes. */
export function generateBackupCodes(count = 10) {
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const codes = [];
    for (let i = 0; i < count; i += 1) {
        const bytes = randomBytes(10);
        let raw = '';
        for (let j = 0; j < 10; j += 1) raw += alphabet[bytes[j] % alphabet.length];
        codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
    }
    return { codes, hashes: codes.map(hashCode) };
}

/** Returns the remaining hashes if `code` matched one (it is consumed), else null. */
export function consumeBackupCode(hashes, code) {
    const target = hashCode(code);
    const idx = (hashes || []).findIndex((h) => h.length === target.length
        && timingSafeEqual(Buffer.from(h), Buffer.from(target)));
    if (idx === -1) return null;
    return hashes.filter((_, i) => i !== idx);
}
