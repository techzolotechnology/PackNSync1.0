import { io as ioClient } from 'socket.io-client';
import { SOCKET_BASE_URL } from '../config/backend.js';

let sharedSocket = null;
let sharedUserId = null;

/**
 * Shared Socket.IO connection for the logged-in user.
 */
export function getTripSocket(userId) {
    if (!userId) return null;

    if (sharedSocket && sharedUserId === userId && sharedSocket.connected) {
        return sharedSocket;
    }

    if (sharedSocket) {
        sharedSocket.disconnect();
        sharedSocket = null;
    }

    sharedUserId = userId;
    sharedSocket = ioClient(SOCKET_BASE_URL, {
        // Read the token on every (re)connect so a refreshed access token is used.
        auth: (cb) => cb({ token: localStorage.getItem('access_token') }),
        transports: ['websocket', 'polling'],
        autoConnect: true,
    });

    // The server rejects expired access tokens and socket.io does not retry a
    // middleware rejection, so refresh the token (via the API interceptor) and
    // reconnect once.
    const socket = sharedSocket;
    let lastRefreshAt = 0;
    socket.on('connect_error', async (err) => {
        if (err?.message !== 'Unauthenticated') return;
        if (Date.now() - lastRefreshAt < 30000) return;
        lastRefreshAt = Date.now();
        try {
            const { authApi } = await import('../api/index.js');
            await authApi.me();
            if (sharedSocket === socket) socket.connect();
        } catch {
            // Signed out — the API interceptor handles the redirect.
        }
    });

    return sharedSocket;
}

export function disconnectTripSocket() {
    if (sharedSocket) {
        sharedSocket.disconnect();
        sharedSocket = null;
        sharedUserId = null;
    }
}
