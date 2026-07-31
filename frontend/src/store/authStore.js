import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '../api/index.js';
import { isTransientNetworkError } from '../utils/apiResilience.js';

export const useAuthStore = create(
    persist(
        (set, get) => ({
            user: null,
            accessToken: null,
            isLoading: false,

            setUser: (user, accessToken) => {
                if (accessToken) localStorage.setItem('access_token', accessToken);
                set({ user, accessToken });
            },

            requestOtp: async (data) => {
                set({ isLoading: true });
                try {
                    const res = await authApi.requestOtp(data);
                    return {
                        success: true,
                        message: res.data?.message,
                        channel: res.data?.channel,
                    };
                } catch (err) {
                    const timedOut = err.code === 'ECONNABORTED' || /timeout/i.test(err.message || '');
                    const network = isTransientNetworkError(err);
                    return {
                        success: false,
                        message:
                            err.response?.data?.message ||
                            (timedOut
                                ? 'OTP request timed out. Please try again in a moment.'
                                : network
                                    ? 'Network blip — connection changed. Please try Get OTP again.'
                                    : 'Failed to request OTP.'),
                    };
                } finally {
                    set({ isLoading: false });
                }
            },

            verifyOtp: async (data) => {
                set({ isLoading: true });
                try {
                    const res = await authApi.verifyOtp(data);
                    const { user, accessToken, refreshToken } = res.data;
                    localStorage.setItem('access_token', accessToken);
                    if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
                    set({ user, accessToken });
                    return { success: true };
                } catch (err) {
                    return { success: false, message: err.response?.data?.message || 'Invalid OTP.' };
                } finally {
                    set({ isLoading: false });
                }
            },

            logout: async () => {
                try { await authApi.logout(); } catch { }
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
                set({ user: null, accessToken: null });
            },

            fetchMe: async () => {
                const token = localStorage.getItem('access_token');
                if (!token) {
                    set({ user: null, accessToken: null });
                    return;
                }
                try {
                    const res = await authApi.me();
                    set({ user: res.data.user, accessToken: token });
                } catch (err) {
                    // A cold start or dropped connection is not a sign-out.
                    const status = err.response?.status;
                    const authFailed = status === 401 || status === 403;
                    if (!authFailed && (isTransientNetworkError(err) || !status)) return;
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('refresh_token');
                    set({ user: null, accessToken: null });
                }
            },

            isAuthenticated: () => !!get().user,
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({ user: state.user, accessToken: state.accessToken }),
        }
    )
);
