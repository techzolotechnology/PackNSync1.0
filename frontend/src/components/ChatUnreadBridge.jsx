import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore.js';
import { useChatUnreadStore } from '../store/chatUnreadStore.js';
import { getTripSocket, disconnectTripSocket } from '../utils/tripSocket.js';

/**
 * Keeps a socket connection for chat unread while logged in,
 * even when the user is not on a trip Chat tab.
 */
export default function ChatUnreadBridge() {
    const user = useAuthStore((s) => s.user);
    const load = useChatUnreadStore((s) => s.load);
    const bump = useChatUnreadStore((s) => s.bump);
    const reset = useChatUnreadStore((s) => s.reset);

    useEffect(() => {
        if (!user?.id) {
            reset();
            disconnectTripSocket();
            return undefined;
        }

        load();
        const socket = getTripSocket(user.id);
        if (!socket) return undefined;

        const onActivity = ({ tripId }) => {
            if (tripId) bump(tripId, 1);
        };

        socket.on('chat_activity', onActivity);
        if (!socket.connected) socket.connect();

        const interval = setInterval(load, 60000);

        return () => {
            socket.off('chat_activity', onActivity);
            clearInterval(interval);
        };
    }, [user?.id, load, bump, reset]);

    return null;
}
