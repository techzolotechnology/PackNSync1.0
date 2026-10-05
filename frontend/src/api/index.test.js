import { describe, it, expect, vi } from 'vitest';

// Set up mock browser globals immediately before any ESM imports are processed
globalThis.localStorage = {
    getItem: vi.fn(() => 'mock-token'),
    setItem: vi.fn(),
    removeItem: vi.fn(),
};

globalThis.window = {
    location: {
        protocol: 'http:',
        href: '',
    },
};

vi.mock('axios', () => {
    return {
        default: {
            create: vi.fn(() => ({
                interceptors: {
                    request: { use: vi.fn() },
                    response: { use: vi.fn() },
                },
                post: vi.fn().mockResolvedValue({ data: { success: true } }),
                get: vi.fn().mockResolvedValue({ data: [{ id: '1' }] }),
            })),
        },
    };
});

describe('Frontend API Mappings', () => {
    it('should map authApi OTP calls to correct endpoints', async () => {
        const { default: api, authApi } = await import('./index.js');
        api.post = vi.fn().mockResolvedValue({ data: { success: true } });

        await authApi.requestOtp({ contact: 'test@example.com' });
        expect(api.post).toHaveBeenCalledWith('/auth/request-otp', { contact: 'test@example.com' }, expect.any(Object));

        await authApi.verifyOtp({ contact: 'test@example.com', otpCode: '123456' });
        expect(api.post).toHaveBeenCalledWith('/auth/verify-otp', { contact: 'test@example.com', otpCode: '123456' }, expect.any(Object));
    });

    it('should map tripsApi calls to correct endpoints', async () => {
        const { default: api, tripsApi } = await import('./index.js');
        api.get = vi.fn().mockResolvedValue({ data: [] });
        api.post = vi.fn().mockResolvedValue({ data: {} });

        await tripsApi.getById('trip_123');
        expect(api.get).toHaveBeenCalledWith('/trips/trip_123', { params: undefined });

        await tripsApi.getById('trip_123', { invite: 'CODE' });
        expect(api.get).toHaveBeenCalledWith('/trips/trip_123', { params: { invite: 'CODE' } });

        await tripsApi.join('trip_123', { inviteCode: 'CODE' });
        expect(api.post).toHaveBeenCalledWith('/trips/trip_123/join', { inviteCode: 'CODE' });
    });
});
