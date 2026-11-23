import { useEffect, useState } from 'react';
import { GROWTH_EVENTS } from '../../../../shared/websiteGrowth.mjs';
import { adminApi } from '../../api/index.js';

export default function AdminWebsiteGrowth() {
    const [rows, setRows] = useState(null);
    const [error, setError] = useState(false);
    const [selected, setSelected] = useState('landing');

    useEffect(() => {
        let active = true;
        adminApi.getWebsiteGrowth()
            .then(({ data }) => { if (active) setRows(data.data); })
            .catch(() => { if (active) setError(true); });
        return () => { active = false; };
    }, []);

    const totals = {};
    for (const row of rows || []) {
        totals[row.event] = (totals[row.event] || 0) + row.count;
    }
    const breakdown = rows?.filter((row) => row.event === selected) || [];

    return (
        <section className="card adm-website-growth" aria-labelledby="adm-growth-title">
            <h2 id="adm-growth-title">Website growth</h2>
            <p className="text-muted">Last 30 days (IST). Counts reflect website actions. A visitor can take the same action more than once.</p>
            {error && <p role="status">Website growth data is unavailable. Refresh the page to try again.</p>}
            {!rows && !error && <p role="status">Loading website growth…</p>}
            {rows && (
                <>
                    <label htmlFor="adm-growth-event">Action</label>
                    <select id="adm-growth-event" value={selected} onChange={(event) => setSelected(event.target.value)}>
                        {Object.entries(GROWTH_EVENTS).map(([event, label]) => (
                            <option key={event} value={event}>{label} ({totals[event] || 0})</option>
                        ))}
                    </select>
                    {breakdown.length ? (
                        <div className="admin-table-wrap">
                            <table className="admin-table">
                                <thead><tr><th scope="col">Source</th><th scope="col">Landing page</th>
                                    <th scope="col">Rental market</th><th scope="col">Count</th></tr></thead>
                                <tbody>
                                    {breakdown.map(({ source, landing, market, vehicle, count }) => (
                                        <tr key={`${source}|${landing}|${market}|${vehicle}`}>
                                            <td>{source}</td><td>{landing}</td>
                                            <td>{market ? `${market} · ${vehicle}` : '—'}</td><td>{count}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : <p className="text-muted">No recorded activity for this action.</p>}
                </>
            )}
        </section>
    );
}
