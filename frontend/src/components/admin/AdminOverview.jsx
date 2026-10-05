import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminApi } from '../../api/index.js';
import { formatMoney } from '../../config/markets.js';
import DailyColumnChart from './DailyColumnChart.jsx';

const compactMoney = (v) => {
    const n = Number(v) || 0;
    const short = (x) => x.toFixed(1).replace(/\.0$/, '');
    if (n >= 1e7) return `₹${short(n / 1e7)}Cr`;
    if (n >= 1e5) return `₹${short(n / 1e5)}L`;
    if (n >= 1e3) return `₹${short(n / 1e3)}K`;
    return formatMoney(n);
};

/** Admin home: what needs action now, then how the business is doing. */
export default function AdminOverview({ onNavigate }) {
    const [data, setData] = useState(null);

    const load = useCallback(async () => {
        try {
            const res = await adminApi.getOverview();
            setData(res.data.data);
        } catch {
            toast.error('Failed to load overview.');
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const q = data?.queue;
    const queue = [
        {
            key: 'rep',
            label: 'Reports to handle',
            value: q?.openReports,
            note: q?.highPriorityReports ? `${q.highPriorityReports} high priority` : null,
            urgent: Boolean(q?.highPriorityReports),
            go: () => onNavigate('Reports'),
        },
        { key: 'kyc', label: 'KYC to review', value: q?.pendingKyc, go: () => onNavigate('Trust', 'kyc') },
        { key: 'rc', label: 'Vehicle RC to review', value: q?.vehiclesAwaitingReview, go: () => onNavigate('Trust', 'vehicles') },
        {
            key: 'wd',
            label: 'Withdrawals to pay out',
            value: q?.pendingWithdrawals,
            note: q?.pendingWithdrawals ? `${formatMoney(q.pendingWithdrawalAmount)} held` : null,
            go: () => onNavigate('Money', 'withdrawals'),
        },
        { key: 'bk', label: 'Bookings awaiting host', value: q?.pendingBookings, go: () => onNavigate('Rentals', 'bookings') },
        { key: 'hold', label: 'Host payouts on hold', value: q?.earningsOnHold, go: () => onNavigate('Money', 'earnings') },
        { key: 'stk', label: 'Stuck top-ups', value: q?.stuckTopups, go: () => onNavigate('Money', 'topups') },
    ];
    const queueTotal = queue.reduce((s, item) => s + (item.value || 0), 0);

    return (
        <div className="adm-overview">
            <section className="adm-queue" aria-labelledby="adm-queue-title">
                <div className="adm-section-head">
                    <h2 id="adm-queue-title">Needs attention</h2>
                    <span className={`badge ${queueTotal ? 'badge-warning' : 'badge-success'}`}>
                        {data ? (queueTotal ? `${queueTotal} open` : 'All clear') : '…'}
                    </span>
                </div>
                <div className="adm-queue-grid">
                    {queue.map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            className={`adm-queue-card ${item.value ? 'has-items' : ''} ${item.urgent ? 'is-urgent' : ''}`}
                            onClick={item.go}
                        >
                            <span className="adm-queue-label">{item.label}</span>
                            <strong>{item.value ?? '—'}</strong>
                            <span className="adm-queue-note">{item.note || (item.value ? 'Review →' : 'Nothing waiting')}</span>
                        </button>
                    ))}
                </div>
            </section>

            <section className="adm-kpis" aria-label="Key figures">
                <div className="adm-kpi">
                    <span>Revenue, last 30 days</span>
                    <strong>{data ? compactMoney(data.money.gmv30) : '—'}</strong>
                    <em>{data?.money.paidBookings30 ?? 0} {data?.money.paidBookings30 === 1 ? 'paid booking' : 'paid bookings'}</em>
                </div>
                <div className="adm-kpi">
                    <span>New users, last 30 days</span>
                    <strong>{data?.growth.signups30 ?? '—'}</strong>
                    <em>{data?.growth.signups7 ?? 0} in the last 7 days</em>
                </div>
                <div className="adm-kpi">
                    <span>Signups from referrals</span>
                    <strong>{data?.growth.referredSignups30 ?? '—'}</strong>
                    <em>
                        {data?.growth.referralRewards ?? 0} {data?.growth.referralRewards === 1 ? 'reward' : 'rewards'} paid all-time
                    </em>
                </div>
                <div className="adm-kpi">
                    <span>Trips created, last 30 days</span>
                    <strong>{data?.growth.tripsCreated30 ?? '—'}</strong>
                    <em>group trips posted</em>
                </div>
                <div className="adm-kpi">
                    <span>Commission, last 30 days</span>
                    <strong>{data ? compactMoney(data.money.commission30) : '—'}</strong>
                    <em>2% added on rentals</em>
                </div>
                <div className="adm-kpi">
                    <span>Owed to hosts</span>
                    <strong>{data ? compactMoney(data.money.owedToHosts) : '—'}</strong>
                    <em>released after each trip ends</em>
                </div>
                <div className="adm-kpi">
                    <span>Cash held in wallets</span>
                    <strong>{data ? compactMoney(data.money.walletCashHeld) : '—'}</strong>
                    <em>owed to users on withdrawal</em>
                </div>
                <div className="adm-kpi">
                    <span>Promo credit outstanding</span>
                    <strong>{data ? compactMoney(data.money.promoOutstanding) : '—'}</strong>
                    <em>spendable, not withdrawable</em>
                </div>
            </section>

            {data && (
                <div className="adm-chart-grid">
                    <DailyColumnChart
                        title="New users per day"
                        subtitle="Last 30 days (IST)"
                        series={data.series.signups}
                    />
                    <DailyColumnChart
                        title="Revenue per day"
                        subtitle="Paid bookings, last 30 days (IST)"
                        series={data.series.revenue}
                        format={(v) => compactMoney(v)}
                    />
                </div>
            )}
        </div>
    );
}
