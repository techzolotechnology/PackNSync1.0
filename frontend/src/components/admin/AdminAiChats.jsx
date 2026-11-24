import { useEffect, useState } from 'react';
import { adminApi } from '../../api/index.js';
import './AdminAiChats.css';

const chatType = (chat) => chat.kind === 'TRIP_DRAFT' ? 'Trip draft' : 'Place chat';

export default function AdminAiChats() {
    const [term, setTerm] = useState('');
    const [filters, setFilters] = useState({ page: 1, search: '' });
    const [list, setList] = useState(null);
    const [selected, setSelected] = useState(null);
    const [transcript, setTranscript] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        adminApi.getAiChats(filters).then(({ data }) => {
            if (active) setList(data.data);
        }).catch((requestError) => {
            if (active) setError(requestError.response?.data?.message || 'Could not load saved AI chats.');
        });
        return () => { active = false; };
    }, [filters]);

    useEffect(() => {
        if (!selected) return;
        let active = true;
        adminApi.getAiChat(selected).then(({ data }) => {
            if (active) setTranscript(data.data);
        }).catch((requestError) => {
            if (active) setError(requestError.response?.data?.message || 'Could not open this transcript.');
        });
        return () => { active = false; };
    }, [selected]);

    const updateFilters = (next) => {
        setList(null);
        setSelected(null);
        setTranscript(null);
        setError('');
        setFilters(next);
    };

    return (
        <div className="admin-panel">
            <div className="admin-panel-head">
                <div><h2>AI chats</h2><p>Review saved place chats and trip drafts with the contact details users supplied.</p></div>
            </div>
            <div className="admin-panel-body admin-ai-chats">
                <form className="admin-ai-actions" onSubmit={(event) => {
                    event.preventDefault();
                    updateFilters({ page: 1, search: term.trim() });
                }}>
                    <input className="form-input" aria-label="Search by name or mobile" placeholder="Name or mobile number"
                        maxLength={80} value={term} onChange={(event) => setTerm(event.target.value)} />
                    <button className="btn btn-primary" type="submit">Search</button>
                </form>
                {error && <p role="alert">{error}</p>}
                {!list && !error && <p role="status">Loading chats…</p>}
                {list?.chats.length === 0 && <p>No saved chats found.</p>}
                {list && list.chats.length > 0 && (
                    <ul className="admin-ai-list">
                        {list.chats.map((chat) => (
                            <li key={chat.id}>
                                <button className="btn btn-ghost" type="button" aria-pressed={chat.id === selected} onClick={() => {
                                    if (selected === chat.id) return;
                                    setError('');
                                    setTranscript(null);
                                    setSelected(chat.id);
                                }}>
                                    <strong>{chat.displayName}</strong><span>{chat.phoneNumber}</span>
                                    <small>{chatType(chat)} · {chat.userId ? 'Account' : 'Guest'}</small>
                                    <time dateTime={chat.updatedAt}>{new Date(chat.updatedAt).toLocaleString('en-IN')}</time>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
                {list && list.pages > 1 && (
                    <div className="admin-ai-actions">
                        <button type="button" className="btn btn-ghost" disabled={list.page === 1}
                            onClick={() => updateFilters({ ...filters, page: list.page - 1 })}>Previous</button>
                        <span>Page {list.page} of {list.pages}</span>
                        <button type="button" className="btn btn-ghost" disabled={list.page >= list.pages}
                            onClick={() => updateFilters({ ...filters, page: list.page + 1 })}>Next</button>
                    </div>
                )}
                {selected && !transcript && !error && <p role="status">Opening transcript…</p>}
                {transcript && (
                    <section className="admin-ai-transcript" aria-label="Saved AI transcript">
                        <div className="admin-ai-actions">
                            <h3>{transcript.displayName} · {chatType(transcript)}</h3>
                            <button type="button" className="btn btn-ghost" onClick={() => {
                                setSelected(null);
                                setTranscript(null);
                            }}>Close transcript</button>
                        </div>
                        <p>{transcript.phoneNumber}</p>
                        <ol>
                            {transcript.messages.map((entry) => (
                                <li key={entry.id}>
                                    <strong>{entry.role === 'assistant' ? 'Assistant' : 'User'}</strong>
                                    <p>{entry.content}</p>
                                </li>
                            ))}
                        </ol>
                    </section>
                )}
            </div>
        </div>
    );
}
