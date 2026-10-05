import { describe, it, expect } from 'vitest';
import {
    base32Decode, base32Encode, consumeBackupCode, generateBackupCodes, generateTotpSecret, totpAt, verifyTotp,
} from './totp.js';

// RFC 6238 Appendix B (SHA-1), secret = ASCII "12345678901234567890"
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));

describe('totp', () => {
    it('matches the RFC 6238 test vectors (last 6 digits)', () => {
        expect(totpAt(RFC_SECRET, Math.floor(59 / 30))).toBe('287082');
        expect(totpAt(RFC_SECRET, Math.floor(1111111109 / 30))).toBe('081804');
        expect(totpAt(RFC_SECRET, Math.floor(1234567890 / 30))).toBe('005924');
    });

    it('round-trips base32', () => {
        const secret = generateTotpSecret();
        expect(base32Encode(base32Decode(secret))).toBe(secret);
        expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    });

    it('accepts the current code and tolerates one step of clock drift', () => {
        const now = 1_700_000_000_000;
        const step = Math.floor(now / 1000 / 30);
        expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, step), { now })).toBe(step);
        expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, step - 1), { now })).toBe(step - 1);
        expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, step - 3), { now })).toBeNull();
        expect(verifyTotp(RFC_SECRET, 'abcdef', { now })).toBeNull();
    });

    it('refuses to accept the same code twice', () => {
        const now = 1_700_000_000_000;
        const step = Math.floor(now / 1000 / 30);
        const code = totpAt(RFC_SECRET, step);
        expect(verifyTotp(RFC_SECRET, code, { now, lastStep: step })).toBeNull();
    });

    it('backup codes work exactly once', () => {
        const { codes, hashes } = generateBackupCodes(3);
        expect(codes[0]).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
        const left = consumeBackupCode(hashes, codes[1].toLowerCase());
        expect(left).toHaveLength(2);
        expect(consumeBackupCode(left, codes[1])).toBeNull();
    });
});
