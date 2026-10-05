import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/**
 * AES-256-GCM for small secrets at rest (e.g. TOTP seeds), so a database leak
 * alone does not hand out admins' authenticator secrets.
 * Key: SECRET_BOX_KEY, falling back to a key derived from JWT_SECRET.
 */
function key() {
    const material = process.env.SECRET_BOX_KEY || process.env.JWT_SECRET;
    if (!material) throw new Error('SECRET_BOX_KEY or JWT_SECRET must be set to store secrets.');
    return createHash('sha256').update(`pickandsync-secretbox:${material}`).digest();
}

export function seal(plaintext) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key(), iv);
    const body = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
    return `v1:${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${body.toString('base64url')}`;
}

export function open(sealed) {
    const [version, iv, tag, body] = String(sealed || '').split(':');
    if (version !== 'v1' || !iv || !tag || !body) throw new Error('Unreadable sealed secret.');
    const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()]).toString('utf8');
}
