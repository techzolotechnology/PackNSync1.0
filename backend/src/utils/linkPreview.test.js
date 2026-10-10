import { describe, it, expect } from 'vitest';
import { isLinkPreviewBot } from './linkPreview.js';

describe('isLinkPreviewBot', () => {
    it('recognises the apps that build link previews', () => {
        expect(isLinkPreviewBot('WhatsApp/2.23.20.0 A')).toBe(true);
        expect(isLinkPreviewBot('facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)')).toBe(true);
        expect(isLinkPreviewBot('TelegramBot (like TwitterBot)')).toBe(true);
        expect(isLinkPreviewBot('Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)')).toBe(true);
        expect(isLinkPreviewBot('LinkedInBot/1.0 (compatible; Mozilla/5.0)')).toBe(true);
    });

    it('treats browsers as people', () => {
        expect(isLinkPreviewBot('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36')).toBe(false);
        expect(isLinkPreviewBot('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1')).toBe(false);
    });

    it('treats a missing user agent as a bot so no preview is lost', () => {
        expect(isLinkPreviewBot('')).toBe(true);
        expect(isLinkPreviewBot(undefined)).toBe(true);
    });
});
