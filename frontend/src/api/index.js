import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || (window.location.protocol === 'file:' ? 'http://127.0.0.1:3001/api' : '/api'),
    withCredentials: true,
    headers: { 'Content-Type': 'application/json' },
    // Prevent login UI from hanging forever when the API/SMTP stalls
    timeout: 20000,
});

// Request interceptor: attach access token from localStorage
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// Response interceptor: auto-refresh on 401
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach((prom) => (error ? prom.reject(error) : prom.resolve(token)));
    failedQueue = [];
};

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        if (!originalRequest) return Promise.reject(error);

        const url = originalRequest.url || '';
        const isAuthRefresh = url.includes('/auth/refresh');
        const isAuthPublic = isAuthRefresh
            || url.includes('/auth/request-otp')
            || url.includes('/auth/verify-otp');

        // Never retry refresh/login endpoints — that causes an infinite 401 loop
        // and leaves pages stuck on "Loading…"
        if (error.response?.status === 401 && !originalRequest._retry && !isAuthPublic) {
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then((token) => {
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return api(originalRequest);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const res = await api.post('/auth/refresh');
                const { accessToken } = res.data;
                localStorage.setItem('access_token', accessToken);
                processQueue(null, accessToken);
                originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                return api(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError, null);
                localStorage.removeItem('access_token');
                try {
                    localStorage.removeItem('auth-storage');
                } catch { /* ignore */ }
                if (!window.location.pathname.startsWith('/login')) {
                    window.location.href = '/login';
                }
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

export default api;

// ── Helper functions ──────────────────────────────────────────────

export const authApi = {
    requestOtp: (data) => api.post('/auth/request-otp', data),
    verifyOtp: (data) => api.post('/auth/verify-otp', data),
    logout: () => api.post('/auth/logout'),
    refresh: () => api.post('/auth/refresh'),
    me: () => api.get('/auth/me'),
};

export const tripsApi = {
    getAll: (params) => api.get('/trips', { params }),
    getMine: (params) => api.get('/trips/mine', { params }),
    getCoverSuggestions: (q) => api.get('/trips/cover-suggestions', { params: { q } }),
    getById: (id) => api.get(`/trips/${id}`),
    getCarSuggestions: (id, params) => api.get(`/trips/${id}/car-suggestions`, { params }),
    create: (data) => api.post('/trips', data),
    update: (id, data) => api.put(`/trips/${id}`, data),
    delete: (id) => api.delete(`/trips/${id}`),
    join: (id) => api.post(`/trips/${id}/join`),
    leave: (id) => api.post(`/trips/${id}/leave`),
    updateMember: (tripId, userId, data) => api.put(`/trips/${tripId}/members/${userId}`, data),
    createAnnouncement: (id, data) => api.post(`/trips/${id}/announcements`, data),
    deleteAnnouncement: (tripId, announcementId) => api.delete(`/trips/${tripId}/announcements/${announcementId}`),
    getMessages: (id, params) => api.get(`/trips/${id}/messages`, { params }),
    getChatUnread: () => api.get('/trips/chat-unread'),
    markChatRead: (id) => api.post(`/trips/${id}/messages/read`),
};

export const itineraryApi = {
    getAll: (tripId) => api.get(`/trips/${tripId}/itinerary`),
    create: (tripId, data) => api.post(`/trips/${tripId}/itinerary`, data),
    update: (tripId, itemId, data) => api.put(`/trips/${tripId}/itinerary/${itemId}`, data),
    delete: (tripId, itemId) => api.delete(`/trips/${tripId}/itinerary/${itemId}`),
};

export const expensesApi = {
    getAll: (tripId) => api.get(`/trips/${tripId}/expenses`),
    create: (tripId, data) => api.post(`/trips/${tripId}/expenses`, data),
    delete: (tripId, expenseId) => api.delete(`/trips/${tripId}/expenses/${expenseId}`),
    getBalances: (tripId) => api.get(`/trips/${tripId}/expenses/balances`),
};

export const usersApi = {
    getById: (id) => api.get(`/users/${id}`),
    update: (id, data) => api.put(`/users/${id}`, data),
    delete: (id) => api.delete(`/users/${id}`),
    getTrips: (id) => api.get(`/users/${id}/trips`),
    uploadAvatar: (file) => {
        const form = new FormData();
        form.append('image', file);
        return api.post('/users/avatar', form, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },
};

export const notificationsApi = {
    getAll: () => api.get('/notifications'),
    markRead: (id) => api.put(`/notifications/${id}/read`),
    markAllRead: () => api.put('/notifications/read-all'),
};

export const ridesApi = {
    getProviders: () => api.get('/rides/providers'),
    getUberSetup: () => api.get('/rides/uber/setup'),
    compare: (params) => api.get('/rides/compare', { params }),
    getLinkedAccounts: () => api.get('/rides/linked-accounts'),
    linkAccount: (data) => api.post('/rides/link-account', data),
    sendOTP: (data) => api.post('/rides/auth/otp/send', data),
    verifyOTP: (data) => api.post('/rides/auth/otp/verify', data),
    book: (data) => api.post('/rides/book', data),
    getMyRides: () => api.get('/rides/my'),
};

export const rentalsApi = {
    getListings: (params) => api.get('/rentals/listings', { params }),
    getSuggestions: (params) => api.get('/rentals/suggestions', { params }),
    getById: (id) => api.get(`/rentals/listings/${id}`),
    createListing: (data) => api.post('/rentals/listings', data),
    book: (data) => api.post('/rentals/bookings', data),
    getMyBookings: () => api.get('/rentals/bookings/my'),
    getHostBookings: () => api.get('/rentals/bookings/host'),
    cancelBooking: (id) => api.patch(`/rentals/bookings/${id}/cancel`),
    respondToBooking: (id, status) => api.patch(`/rentals/bookings/${id}/respond`, { status }),
    payBooking: (id) => api.post(`/rentals/bookings/${id}/pay`),
};

export const vehiclesApi = {
    create: (data) => api.post('/vehicles', data),
    getMine: () => api.get('/vehicles/my'),
    getById: (id) => api.get(`/vehicles/${id}`),
    update: (id, data) => api.put(`/vehicles/${id}`, data),
    delete: (id) => api.delete(`/vehicles/${id}`),
    uploadImage: (file) => {
        const form = new FormData();
        form.append('image', file);
        return api.post('/vehicles/upload-image', form, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },
};

export const exploreApi = {
    getExamples: () => api.get('/explore/examples'),
    getStatus: () => api.get('/explore/status'),
    getPlannerMeta: () => api.get('/explore/planner/meta'),
    search: (query, limit = 5, { lat, lng } = {}) =>
        api.post('/explore/search', { query, limit, lat, lng }),
    chat: (message, { sessionId, lat, lng, limit = 5 } = {}) =>
        api.post('/explore/chat', { message, sessionId, lat, lng, limit }),
    clearChat: (sessionId) => api.post('/explore/chat/clear', { sessionId }),
    getChat: (sessionId) => api.get(`/explore/chat/${sessionId}`),
    listPlans: () => api.get('/explore/plans'),
    generatePlan: (data) => api.post('/explore/plans/generate', data),
    getPlan: (id) => api.get(`/explore/plans/${id}`),
    updatePlan: (id, data) => api.put(`/explore/plans/${id}`, data),
    regeneratePlan: (id, data) => api.post(`/explore/plans/${id}/regenerate`, data),
    savePlan: (id) => api.post(`/explore/plans/${id}/save`),
    deletePlan: (id) => api.delete(`/explore/plans/${id}`),
    updatePlanStop: (planId, stopId, data) => api.patch(`/explore/plans/${planId}/stops/${stopId}`, data),
    deletePlanStop: (planId, stopId) => api.delete(`/explore/plans/${planId}/stops/${stopId}`),
};

export const verificationsApi = {
    getStatus: () => api.get('/verifications/status'),
    getPolicyStatus: () => api.get('/verifications/policies/status'),
    submit: (data) => api.post('/verifications/submit', data),
    connectDigiLocker: () => api.post('/verifications/digilocker/connect'),
    submitRc: (licensePlate) => api.post('/verifications/digilocker/rc', { licensePlate }),
    uploadRcOcr: (licensePlate, file) => {
        const form = new FormData();
        form.append('licensePlate', licensePlate);
        form.append('rcImage', file);
        return api.post('/verifications/rc/upload', form, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },
    acceptPolicy: (policyType) => api.post('/verifications/policies/accept', { policyType }),
};

export const adminApi = {
    getStats: () => api.get('/admin/stats'),
    getUsers: (params) => api.get('/admin/users', { params }),
    updateUserRole: (id, role) => api.put(`/admin/users/${id}/role`, { role }),
    banUser: (id, isBanned, banReason) => api.put(`/admin/users/${id}/ban`, { isBanned, banReason }),
    deleteUser: (id) => api.delete(`/admin/users/${id}`),
    getTrips: (params) => api.get('/admin/trips', { params }),
    getHosts: () => api.get('/admin/hosts'),
    updateTrip: (id, data) => api.patch(`/admin/trips/${id}`, data),
    updateTripMember: (tripId, userId, status) => api.put(`/admin/trips/${tripId}/members/${userId}`, { status }),
    deleteTrip: (id) => api.delete(`/admin/trips/${id}`),
    getVerifications: (params) => api.get('/admin/verifications', { params }),
    approveVerification: (id) => api.put(`/admin/verifications/${id}/approve`),
    rejectVerification: (id, reason) => api.put(`/admin/verifications/${id}/reject`, { reason }),
    getVehicles: () => api.get('/admin/vehicles'),
    verifyVehicle: (id) => api.put(`/admin/vehicles/${id}/verify`),
    rejectVehicle: (id, reason) => api.put(`/admin/vehicles/${id}/reject`, { reason }),
    getRentalListings: () => api.get('/admin/rentals/listings'),
    setListingActive: (id, isActive) => api.patch(`/admin/rentals/listings/${id}`, { isActive }),
    getRentalBookings: (params) => api.get('/admin/rentals/bookings', { params }),
    updateBookingStatus: (id, status) => api.patch(`/admin/rentals/bookings/${id}`, { status }),
    getPayments: (params) => api.get('/admin/payments', { params }),
    refundPayment: (id) => api.post(`/admin/payments/${id}/refund`),
};
