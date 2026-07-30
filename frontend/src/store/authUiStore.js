import { create } from 'zustand';

/**
 * Opens login/register as a modal on the main site (no separate auth pages).
 */
export const useAuthUiStore = create((set) => ({
    open: false,
    mode: 'login', // 'login' | 'register'
    openAuth: (mode = 'login') => set({ open: true, mode: mode === 'register' ? 'register' : 'login' }),
    closeAuth: () => set({ open: false }),
    setMode: (mode) => set({ mode: mode === 'register' ? 'register' : 'login' }),
}));
