import { Link } from 'react-router-dom';
import './DeleteAccountPage.css';

const DELETION_EMAIL = 'privacy@packandsync.com';
const REQUEST_SUBJECT = 'Account deletion request — PickAndSync / PackNSync';
const REQUEST_BODY = [
    'Hello PickAndSync / PackNSync Privacy Team,',
    '',
    'I request deletion of my account and associated personal data.',
    'Registered account email: ',
    'App used (PickAndSync or PackNSync): ',
    '',
    'Please tell me if you need information to verify that I own this account.',
].join('\n');

const mailto = `mailto:${DELETION_EMAIL}?subject=${encodeURIComponent(REQUEST_SUBJECT)}&body=${encodeURIComponent(REQUEST_BODY)}`;

export default function DeleteAccountPage() {
    return (
        <main className="delete-account-page page-enter">
            <div className="delete-account-container">
                <header className="delete-account-header">
                    <span className="delete-account-eyebrow">Your account, your choice</span>
                    <h1>Delete your account</h1>
                    <p>
                        Use this page to request deletion of your PickAndSync or PackNSync account
                        and associated personal data. You do not need to reinstall or sign in to the app.
                    </p>
                </header>

                <section className="delete-account-card" aria-labelledby="request-deletion-heading">
                    <h2 id="request-deletion-heading">Request account deletion</h2>
                    <ol>
                        <li>Send a request from the email address registered to your account.</li>
                        <li>Tell us whether the account is for PickAndSync or PackNSync.</li>
                        <li>We may ask for information to verify account ownership before processing the request.</li>
                    </ol>
                    <a className="delete-account-button" href={mailto}>
                        Email a deletion request
                    </a>
                    <p className="delete-account-email">
                        Or email <a href={`mailto:${DELETION_EMAIL}`}>{DELETION_EMAIL}</a> with the subject
                        “{REQUEST_SUBJECT}”.
                    </p>
                </section>

                <section className="delete-account-card">
                    <h2>What happens next</h2>
                    <p>
                        After we verify the request, we will delete the account and associated data that we
                        can delete, including account profile information and account-linked app content.
                        The account deletion process may be delayed if the account has an active rental,
                        money in its wallet, a payment or withdrawal still processing, or host earnings awaiting
                        payout. We will explain any steps needed to resolve these items.
                    </p>
                    <p>
                        Some records may need to be retained where required for legal, accounting, security,
                        fraud-prevention, or dispute-resolution purposes. Payment providers may also retain
                        records under their own policies. See our <Link to="/privacy-policy">Privacy Policy</Link>
                        {' '}for data handling details.
                    </p>
                </section>

                <p className="delete-account-operator">
                    PickAndSync and PackNSync are operated by TECHZOLO TECHNOLOGIES LLP.
                </p>
            </div>
        </main>
    );
}
