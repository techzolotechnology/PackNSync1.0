import { Link } from 'react-router-dom';
import './AiContactFields.css';

export const initialAiContact = (user) => ({ name: user?.name || '', mobile: user?.phoneNumber || '', consent: false });

export default function AiContactFields({ contact, onChange, disabled }) {
    return (
        <fieldset className="ai-contact-fields" disabled={disabled}>
            <legend>Who am I chatting with?</legend>
            <label>
                Your name
                <input className="form-input" autoComplete="name" maxLength={80} minLength={2} required
                    value={contact.name} onChange={(event) => onChange({ ...contact, name: event.target.value })} />
            </label>
            <label>
                Your mobile number
                <input className="form-input" type="tel" autoComplete="tel" maxLength={24} required
                    placeholder="e.g. +91 98765 43210"
                    value={contact.mobile} onChange={(event) => onChange({ ...contact, mobile: event.target.value })} />
            </label>
            <label className="ai-contact-consent">
                <input type="checkbox" required checked={contact.consent}
                    onChange={(event) => onChange({ ...contact, consent: event.target.checked })} />
                <span>I agree that PickAndSync can save my chat, name and number for authorised staff to review. <Link to="/privacy-policy">Privacy policy</Link></span>
            </label>
        </fieldset>
    );
}
