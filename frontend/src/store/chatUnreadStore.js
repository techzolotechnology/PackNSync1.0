import { create } from 'zustand';
import { tripsApi } from '../api/index.js';

export const useChatUnreadStore = create((set, get) => ({
    total: 0,
    byTrip: {},
    /** Trip whose Chat tab is currently open — don't bump unread for it */
    activeTripId: null,

    setActiveTripId: (tripId) => set({ activeTripId: tripId }),

    load: async () => {
        try {
            const res = await tripsApi.getChatUnread();
            const data = res.data?.data || { total: 0, byTrip: [] };
            const byTrip = {};
            for (const row of data.byTrip || []) {
                byTrip[row.tripId] = row.count;
            }
            set({ total: data.total || 0, byTrip });
        } catch {
            /* ignore */
        }
    },

    bump: (tripId, amount = 1) => {
        if (!tripId) return;
        if (get().activeTripId === tripId) return;
        set((state) => {
            const nextCount = (state.byTrip[tripId] || 0) + amount;
            const byTrip = { ...state.byTrip, [tripId]: nextCount };
            const total = Object.values(byTrip).reduce((sum, n) => sum + n, 0);
            return { byTrip, total };
        });
    },

    clearTrip: (tripId) => {
        if (!tripId) return;
        set((state) => {
            if (!state.byTrip[tripId]) return state;
            const byTrip = { ...state.byTrip };
            delete byTrip[tripId];
            const total = Object.values(byTrip).reduce((sum, n) => sum + n, 0);
            return { byTrip, total };
        });
    },

    reset: () => set({ total: 0, byTrip: {}, activeTripId: null }),
}));
