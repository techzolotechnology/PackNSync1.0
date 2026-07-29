import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, isSameDay, isToday, isYesterday } from 'date-fns';
import toast from 'react-hot-toast';
import { tripsApi } from '../api/index.js';
import { getTripSocket } from '../utils/tripSocket.js';
import { useChatUnreadStore } from '../store/chatUnreadStore.js';
import './TripChat.css';

function dayLabel(date) {
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'EEEE, MMM d');
}

function buildTimeline(messages) {
    const items = [];
    let lastDay = null;
    for (const m of messages) {
        const created = m.createdAt ? new Date(m.createdAt) : null;
        if (created && (!lastDay || !isSameDay(lastDay, created))) {
            items.push({ type: 'day', key: `day-${created.toDateString()}`, label: dayLabel(created) });
            lastDay = created;
        }
        items.push({ type: 'message', key: m.id, message: m });
    }
    return items;
}

export default function TripChat({ tripId, user, canChat, members = [] }) {
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(true);
    const [connected, setConnected] = useState(false);
    const [typingUsers, setTypingUsers] = useState({});
    const [onlineUserIds, setOnlineUserIds] = useState([]);
    const [showJump, setShowJump] = useState(false);
    const listRef = useRef(null);
    const typingTimer = useRef(null);
    const stickToBottom = useRef(true);

    const setActiveTripId = useChatUnreadStore((s) => s.setActiveTripId);
    const clearTrip = useChatUnreadStore((s) => s.clearTrip);

    const markRead = async () => {
        try {
            await tripsApi.markChatRead(tripId);
            clearTrip(tripId);
        } catch {
            /* ignore */
        }
    };

    useEffect(() => {
        if (!canChat || !user?.id) return undefined;
        setActiveTripId(tripId);
        markRead();
        return () => setActiveTripId(null);
    }, [tripId, user?.id, canChat]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const res = await tripsApi.getMessages(tripId);
                if (!cancelled) setMessages(res.data.data || []);
            } catch (err) {
                if (!cancelled) {
                    toast.error(err.response?.data?.message || 'Could not load chat.');
                    setMessages([]);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [tripId]);

    useEffect(() => {
        if (!user?.id || !canChat) return undefined;

        const socket = getTripSocket(user.id);
        if (!socket) return undefined;

        const onConnect = () => {
            setConnected(true);
            socket.emit('join_trip_room', tripId);
        };
        const onDisconnect = () => {
            setConnected(false);
            setOnlineUserIds([]);
        };
        const onMessage = (message) => {
            if (message?.tripId !== tripId) return;
            setMessages((prev) => {
                if (message.clientTempId) {
                    const withoutTemp = prev.filter((m) => m.id !== message.clientTempId);
                    if (withoutTemp.some((m) => m.id === message.id)) return withoutTemp;
                    return [...withoutTemp, message];
                }
                if (prev.some((m) => m.id === message.id)) return prev;
                return [...prev, message];
            });
            markRead();
        };
        const onTyping = ({ userId, isTyping }) => {
            if (!userId || userId === user.id) return;
            setTypingUsers((prev) => {
                const next = { ...prev };
                if (isTyping) next[userId] = true;
                else delete next[userId];
                return next;
            });
        };
        const onPresence = ({ tripId: tid, onlineUserIds: ids }) => {
            if (tid !== tripId) return;
            setOnlineUserIds(Array.isArray(ids) ? ids : []);
        };
        const onError = (payload) => {
            if (payload?.clientTempId) {
                setMessages((prev) => prev.map((m) => (
                    m.id === payload.clientTempId
                        ? { ...m, pending: false, failed: true }
                        : m
                )));
            }
            toast.error(payload?.message || 'Chat error.');
        };

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('new_message', onMessage);
        socket.on('user_typing', onTyping);
        socket.on('trip_presence', onPresence);
        socket.on('error', onError);

        if (socket.connected) onConnect();
        else socket.connect();

        return () => {
            socket.emit('leave_trip_room', tripId);
            socket.emit('typing', { tripId, isTyping: false });
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('new_message', onMessage);
            socket.off('user_typing', onTyping);
            socket.off('trip_presence', onPresence);
            socket.off('error', onError);
        };
    }, [tripId, user?.id, canChat]);

    useEffect(() => {
        if (!stickToBottom.current || !listRef.current) return;
        listRef.current.scrollTop = listRef.current.scrollHeight;
        setShowJump(false);
    }, [messages, typingUsers]);

    const onScroll = () => {
        const el = listRef.current;
        if (!el) return;
        const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
        const nearBottom = distance < 72;
        stickToBottom.current = nearBottom;
        setShowJump(!nearBottom && messages.length > 8);
    };

    const jumpToLatest = () => {
        const el = listRef.current;
        if (!el) return;
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        stickToBottom.current = true;
        setShowJump(false);
    };

    const emitTyping = (isTyping) => {
        if (!canChat || !user?.id) return;
        const socket = getTripSocket(user.id);
        socket?.emit('typing', { tripId, isTyping });
    };

    const handleChange = (e) => {
        setText(e.target.value);
        emitTyping(true);
        if (typingTimer.current) clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => emitTyping(false), 1200);
    };

    const retryFailed = (failedMsg) => {
        setMessages((prev) => prev.filter((m) => m.id !== failedMsg.id));
        setText(failedMsg.content);
    };

    const send = (e) => {
        e?.preventDefault();
        const content = text.trim();
        if (!content || !canChat || !user?.id) return;

        const socket = getTripSocket(user.id);
        if (!socket?.connected) {
            toast.error('Not connected. Check that the backend is running.');
            return;
        }

        const clientTempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const optimistic = {
            id: clientTempId,
            clientTempId,
            tripId,
            userId: user.id,
            content,
            createdAt: new Date().toISOString(),
            pending: true,
            user: {
                id: user.id,
                name: user.name,
                avatarUrl: user.avatarUrl,
            },
        };

        stickToBottom.current = true;
        setMessages((prev) => [...prev, optimistic]);
        setText('');
        emitTyping(false);
        socket.emit('send_message', { tripId, content, clientTempId });
    };

    const timeline = useMemo(() => buildTimeline(messages), [messages]);

    const presencePeople = useMemo(() => {
        const map = new Map();
        for (const m of members) {
            if (m?.user?.id) map.set(m.user.id, m.user);
        }
        if (user?.id) map.set(user.id, { id: user.id, name: user.name, avatarUrl: user.avatarUrl });
        return onlineUserIds
            .map((id) => map.get(id) || { id, name: 'Member' })
            .filter((p) => p.id !== user?.id);
    }, [members, onlineUserIds, user]);

    if (!user) {
        return (
            <div className="trip-chat locked">
                <p><Link to="/login">Log in</Link> to use trip chat.</p>
            </div>
        );
    }

    if (!canChat) {
        return (
            <div className="trip-chat locked">
                <p>Join this trip and get approved to chat with the group.</p>
            </div>
        );
    }

    const typingCount = Object.keys(typingUsers).length;

    return (
        <div className="trip-chat">
            <div className="trip-chat-head">
                <div>
                    <h2>Group chat</h2>
                    <p>Live messages for organizers and approved members.</p>
                </div>
                <span className={`trip-chat-status ${connected ? 'on' : 'off'}`}>
                    {connected ? 'Live' : 'Connecting…'}
                </span>
            </div>

            {presencePeople.length > 0 && (
                <div className="trip-chat-presence" aria-label="Online members">
                    {presencePeople.slice(0, 8).map((p) => (
                        <div key={p.id} className="trip-chat-presence-item" title={p.name}>
                            {p.avatarUrl
                                ? <img src={p.avatarUrl} alt="" />
                                : <span>{(p.name || '?')[0]}</span>}
                            <i className="online-dot" aria-hidden="true" />
                        </div>
                    ))}
                    <span className="trip-chat-presence-label">
                        {presencePeople.length} online
                    </span>
                </div>
            )}

            <div className="trip-chat-list-wrap">
                <div className="trip-chat-list" ref={listRef} onScroll={onScroll}>
                    {loading && <p className="trip-chat-muted">Loading messages…</p>}
                    {!loading && messages.length === 0 && (
                        <p className="trip-chat-muted">No messages yet — say hi to the group.</p>
                    )}
                    {timeline.map((item) => {
                        if (item.type === 'day') {
                            return (
                                <div key={item.key} className="trip-chat-day">
                                    <span>{item.label}</span>
                                </div>
                            );
                        }
                        const m = item.message;
                        const mine = m.userId === user.id || m.user?.id === user.id;
                        return (
                            <div
                                key={item.key}
                                className={`trip-chat-bubble ${mine ? 'mine' : 'theirs'} ${m.pending ? 'pending' : ''} ${m.failed ? 'failed' : ''}`}
                            >
                                {!mine && (
                                    <div className="trip-chat-author">
                                        {m.user?.avatarUrl
                                            ? <img src={m.user.avatarUrl} alt="" />
                                            : <span>{(m.user?.name || '?')[0]}</span>}
                                        <strong>{m.userId === user.id || m.user?.id === user.id ? 'You' : (m.user?.name || 'Member')}</strong>
                                    </div>
                                )}
                                <p>{m.content}</p>
                                <time>
                                    {m.failed
                                        ? (
                                            <button type="button" className="trip-chat-retry" onClick={() => retryFailed(m)}>
                                                Failed · tap to retry
                                            </button>
                                        )
                                        : m.pending
                                            ? 'Sending…'
                                            : (m.createdAt ? format(new Date(m.createdAt), 'h:mm a') : '')}
                                </time>
                            </div>
                        );
                    })}
                    {typingCount > 0 && (
                        <p className="trip-chat-typing">Someone is typing…</p>
                    )}
                </div>

                {showJump && (
                    <button type="button" className="trip-chat-jump" onClick={jumpToLatest}>
                        Jump to latest
                    </button>
                )}
            </div>

            <form className="trip-chat-composer" onSubmit={send}>
                <input
                    type="text"
                    value={text}
                    onChange={handleChange}
                    placeholder="Message the group…"
                    maxLength={2000}
                    disabled={!connected}
                />
                <button type="submit" className="btn btn-primary" disabled={!connected || !text.trim()}>
                    Send
                </button>
            </form>
        </div>
    );
}
