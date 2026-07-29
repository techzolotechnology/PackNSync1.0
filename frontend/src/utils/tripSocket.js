import { io as ioClient } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

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
    sharedSocket = ioClient(SOCKET_URL, {
        auth: { userId },
        transports: ['websocket', 'polling'],
        autoConnect: true,
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
