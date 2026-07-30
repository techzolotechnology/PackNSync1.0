import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { walletApi } from '../api/index.js';
import { useAuthStore } from '../store/authStore.js';
import { useAuthUiStore } from '../store/authUiStore.js';
import './WalletPage.css';

const PRESETS = [200, 500, 1000, 2000, 5000];

function loadCashfreeSdk() {
    return new Promise((resolve, reject) => {
        if (window.Cashfree) {
            resolve(window.Cashfree);
            return;
        }
        const existing = document.querySelector('script[data-cashfree-sdk]');
        if (existing) {
            existing.addEventListener('load', () => resolve(window.Cashfree));
            existing.addEventListener('error', () => reject(new Error('Cashfree SDK failed to load')));
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
        script.async = true;
        script.dataset.cashfreeSdk = '1';
        script.onload = () => resolve(window.Cashfree);
        script.onerror = () => reject(new Error('Cashfree SDK failed to load'));
        document.body.appendChild(script);
    });
}

const txLabel = (tx) => {
    const map = {
        TOPUP: 'Top-up',
        SPEND: 'Spent',
        WITHDRAW: 'Withdrawn',
        REFUND: 'Refund',
        ADJUST: 'Adjustment',
    };
    return map[tx.type] || tx.type;
};

export default function WalletPage() {
    const user = useAuthStore((s) => s.user);
    const openAuth = useAuthUiStore((s) => s.openAuth);
    const [searchParams, setSearchParams] = useSearchParams();

    const [wallet, setWallet] = useState(null);
    const [txs, setTxs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [topupAmount, setTopupAmount] = useState(500);
    const [busy, setBusy] = useState(false);

    const [withdrawAmount, setWithdrawAmount] = useState(500);
    const [withdrawMode, setWithdrawMode] = useState('upi');
    const [upiId, setUpiId] = useState('');
    const [accountName, setAccountName] = useState(user?.name || '');
    const [accountNumber, setAccountNumber] = useState('');
    const [ifsc, setIfsc] = useState('');

    const refresh = useCallback(async () => {
        const [wRes, tRes] = await Promise.all([
            walletApi.get(),
            walletApi.transactions({ limit: 40 }),
        ]);
        setWallet(wRes.data.data);
        setTxs(tRes.data.data || []);
    }, []);

    useEffect(() => {
        if (!user) return;
        setLoading(true);
        refresh()
            .catch((err) => toast.error(err.response?.data?.message || 'Could not load wallet.'))
            .finally(() => setLoading(false));
    }, [user, refresh]);

    useEffect(() => {
        if (user?.name && !accountName) setAccountName(user.name);
    }, [user, accountName]);

    // Return from Cashfree redirect
    useEffect(() => {
        if (!user) return;
        const topup = searchParams.get('topup');
        const orderId = searchParams.get('order_id');
        if (topup !== 'return' || !orderId) return;

        (async () => {
            try {
                setBusy(true);
                const res = await walletApi.verifyTopup(orderId);
                if (res.data.paid) {
                    toast.success('Wallet topped up successfully.');
                    await refresh();
                } else {
                    toast('Payment still pending — refresh in a moment.', { icon: '⏳' });
                }
            } catch (err) {
                toast.error(err.response?.data?.message || 'Could not verify payment.');
            } finally {
                setBusy(false);
                const next = new URLSearchParams(searchParams);
                next.delete('topup');
                next.delete('order_id');
                setSearchParams(next, { replace: true });
            }
        })();
    }, [user, searchParams, setSearchParams, refresh]);

    const handleTopup = async () => {
        const amount = Number(topupAmount);
        if (!Number.isFinite(amount) || amount < 10) {
            toast.error('Enter at least ₹10.');
            return;
        }
        setBusy(true);
        try {
            const res = await walletApi.topup(amount);
            if (res.data.mock) {
                toast.success(`₹${amount.toLocaleString()} added (dev mock).`);
                await refresh();
                return;
            }

            const { paymentSessionId, cashfreeMode, orderId } = res.data.data;
            const Cashfree = await loadCashfreeSdk();
            const cashfree = Cashfree({ mode: cashfreeMode === 'production' ? 'production' : 'sandbox' });
            const result = await cashfree.checkout({
                paymentSessionId,
                redirectTarget: '_modal',
            });

            if (result?.error) {
                toast.error(result.error.message || 'Checkout cancelled.');
                return;
            }

            // Modal checkout completed — verify with backend
            const verify = await walletApi.verifyTopup(orderId);
            if (verify.data.paid) {
                toast.success(`₹${amount.toLocaleString()} added to wallet.`);
                await refresh();
            } else {
                toast('Payment submitted. Balance updates once Cashfree confirms.', { icon: '⏳' });
                await refresh();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || 'Top-up failed.');
        } finally {
            setBusy(false);
        }
    };

    const handleWithdraw = async () => {
        const amount = Number(withdrawAmount);
        if (!Number.isFinite(amount) || amount < 100) {
            toast.error('Minimum withdrawal is ₹100.');
            return;
        }
        setBusy(true);
        try {
            const payload = {
                amount,
                mode: withdrawMode,
                accountName: accountName.trim(),
            };
            if (withdrawMode === 'upi') payload.upiId = upiId.trim();
            else {
                payload.accountNumber = accountNumber.trim();
                payload.ifsc = ifsc.trim();
            }
            const res = await walletApi.withdraw(payload);
            toast.success(res.data.data?.message || 'Withdrawal submitted.');
            await refresh();
            setUpiId('');
            setAccountNumber('');
            setIfsc('');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Withdrawal failed.');
        } finally {
            setBusy(false);
        }
    };

    if (!user) {
        return (
            <div className="wallet-page">
                <p>
                    Please{' '}
                    <button type="button" className="wallet-linkish" onClick={() => openAuth('login')}>
                        Sync In
                    </button>{' '}
                    to use your wallet.
                </p>
            </div>
        );
    }

    return (
        <div className="wallet-page">
            <header className="wallet-header">
                <div>
                    <p className="wallet-eyebrow">PackAndSync</p>
                    <h1>Wallet</h1>
                    <p>Add money with Cashfree, spend on rentals &amp; more, or withdraw to UPI / bank.</p>
                </div>
                <Link to="/bookings" className="btn btn-ghost btn-sm">My Bookings</Link>
            </header>

            {loading ? (
                <p className="wallet-muted">Loading wallet…</p>
            ) : (
                <>
                    <section className="wallet-balance-panel" aria-live="polite">
                        <span className="wallet-balance-label">Available balance</span>
                        <strong className="wallet-balance-value">
                            ₹{Number(wallet?.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </strong>
                        <span className="wallet-balance-meta">
                            {wallet?.currency || 'INR'}
                            {wallet?.mockMode ? ' · demo mode (no Cashfree keys)' : ` · Cashfree ${wallet?.cashfreeMode || 'sandbox'}`}
                        </span>
                    </section>

                    <div className="wallet-grid">
                        <section className="wallet-panel">
                            <h2>Add money</h2>
                            <p className="wallet-muted">Pay via UPI, cards, or netbanking through Cashfree.</p>
                            <div className="wallet-presets">
                                {PRESETS.map((p) => (
                                    <button
                                        key={p}
                                        type="button"
                                        className={Number(topupAmount) === p ? 'active' : ''}
                                        onClick={() => setTopupAmount(p)}
                                    >
                                        ₹{p.toLocaleString()}
                                    </button>
                                ))}
                            </div>
                            <label className="wallet-field">
                                <span>Amount (₹)</span>
                                <input
                                    type="number"
                                    min={10}
                                    max={100000}
                                    value={topupAmount}
                                    onChange={(e) => setTopupAmount(e.target.value)}
                                />
                            </label>
                            <button
                                type="button"
                                className="btn btn-primary"
                                disabled={busy}
                                onClick={handleTopup}
                            >
                                {busy ? 'Processing…' : 'Add money'}
                            </button>
                        </section>

                        <section className="wallet-panel">
                            <h2>Withdraw outside app</h2>
                            <p className="wallet-muted">Send balance to your UPI ID or bank account (Cashfree Payouts).</p>
                            <div className="wallet-mode-toggle" role="group" aria-label="Withdraw mode">
                                <button
                                    type="button"
                                    className={withdrawMode === 'upi' ? 'active' : ''}
                                    onClick={() => setWithdrawMode('upi')}
                                >
                                    UPI
                                </button>
                                <button
                                    type="button"
                                    className={withdrawMode === 'bank' ? 'active' : ''}
                                    onClick={() => setWithdrawMode('bank')}
                                >
                                    Bank
                                </button>
                            </div>
                            <label className="wallet-field">
                                <span>Amount (₹)</span>
                                <input
                                    type="number"
                                    min={100}
                                    value={withdrawAmount}
                                    onChange={(e) => setWithdrawAmount(e.target.value)}
                                />
                            </label>
                            <label className="wallet-field">
                                <span>Account holder name</span>
                                <input
                                    type="text"
                                    value={accountName}
                                    onChange={(e) => setAccountName(e.target.value)}
                                />
                            </label>
                            {withdrawMode === 'upi' ? (
                                <label className="wallet-field">
                                    <span>UPI ID</span>
                                    <input
                                        type="text"
                                        placeholder="name@upi"
                                        value={upiId}
                                        onChange={(e) => setUpiId(e.target.value)}
                                    />
                                </label>
                            ) : (
                                <>
                                    <label className="wallet-field">
                                        <span>Account number</span>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={accountNumber}
                                            onChange={(e) => setAccountNumber(e.target.value)}
                                        />
                                    </label>
                                    <label className="wallet-field">
                                        <span>IFSC</span>
                                        <input
                                            type="text"
                                            placeholder="HDFC0001234"
                                            value={ifsc}
                                            onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                                        />
                                    </label>
                                </>
                            )}
                            <button
                                type="button"
                                className="btn btn-ghost"
                                disabled={busy}
                                onClick={handleWithdraw}
                            >
                                {busy ? 'Processing…' : 'Withdraw'}
                            </button>
                        </section>
                    </div>

                    <section className="wallet-panel wallet-history">
                        <h2>Activity</h2>
                        {txs.length === 0 ? (
                            <p className="wallet-muted">No transactions yet. Add money to get started.</p>
                        ) : (
                            <ul className="wallet-tx-list">
                                {txs.map((tx) => {
                                    const out = tx.type === 'SPEND' || tx.type === 'WITHDRAW';
                                    return (
                                        <li key={tx.id}>
                                            <div>
                                                <strong>{txLabel(tx)}</strong>
                                                <span>{tx.description || tx.referenceId || '—'}</span>
                                                <small>
                                                    {format(new Date(tx.createdAt), 'MMM d, yyyy · h:mm a')} · {tx.status}
                                                </small>
                                            </div>
                                            <em className={out ? 'out' : 'in'}>
                                                {out ? '−' : '+'}₹{Number(tx.amount).toLocaleString('en-IN')}
                                            </em>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </section>
                </>
            )}
        </div>
    );
}
