import { customerPlayStoreUrl } from '../config/customerApp.js';
import { trackWebsiteEvent } from '../utils/websiteGrowth.js';

export default function CustomerAppLink({ placement, className, children = 'Get the Android app' }) {
    return (
        <a className={className} href={customerPlayStoreUrl(placement)}
            onClick={() => trackWebsiteEvent('android_store_opened')}>
            {children}
        </a>
    );
}
