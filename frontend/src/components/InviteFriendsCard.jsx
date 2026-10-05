import { useEffect, useState } from 'react';
import { usersApi } from '../api/index.js';
import { copyLink, shareLink } from '../utils/share.js';

/** Referral programme: personal invite link + progress. */
export default function InviteFriendsCard({ className = 'wallet-panel wallet-invite' }) {
    const [referral, setReferral] = useState(null);

    useEffect(() => {
        let cancelled = false;
        usersApi.getReferral()
            .then((res) => { if (!cancelled) setReferral(res.data.data); })
            .catch(() => { /* card stays hidden if the API is unavailable */ });
        return () => { cancelled = true; };
    }, []);

    if (!referral) return null;
    const reward = referral.rewardAmount;

    return (
        <section className={className}>
            <h2>Invite friends{reward ? `, earn ₹${reward}` : ''}</h2>
            <p className="wallet-muted">
                {reward
                    ? `Share your link. When a friend signs up and completes their first booking, you both get ₹${reward} credit to use on trips and rentals.`
                    : 'Share your link and plan your next trip together on PickAndSync.'}
            </p>
            <div className="invite-link-row">
                <code className="invite-link">{referral.link}</code>
            </div>
            <div className="invite-actions">
                <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => shareLink({
                        title: 'PickAndSync',
                        text: reward
                            ? `Plan trips with friends, split costs and rent self-drive cars on PickAndSync. Sign up with my link and we both get ₹${reward} credit:`
                            : 'Plan trips with friends, split costs and rent self-drive cars on PickAndSync:',
                        url: referral.link,
                    })}
                >
                    Share on WhatsApp
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => copyLink(referral.link)}>
                    Copy link
                </button>
            </div>
            <p className="wallet-muted invite-stats">
                {referral.invited} signed up · {referral.rewarded} rewarded
            </p>
        </section>
    );
}
