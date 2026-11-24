import toast from 'react-hot-toast';
import { adminApi } from '../api/index.js';

/** True when a verification/vehicle record points at an actual image. */
export function hasViewableDocument(url) {
    return /^https?:\/\//i.test(url || '') || /^\/(api\/admin\/(rc-files|verification-files)|uploads\/(rc|verification))\//.test(url || '');
}

/**
 * Private identity documents are fetched with the admin's token and shown as a blob URL.
 */
export async function openAdminDocument(url) {
    if (!hasViewableDocument(url)) {
        toast('No image for this record (DigiLocker / manual entry).');
        return;
    }
    if (/^https?:\/\//i.test(url)) {
        window.open(url, '_blank', 'noopener');
        return;
    }
    // Open the tab synchronously so popup blockers allow it, then fill it in.
    const tab = window.open('', '_blank');
    try {
        const filename = url.split('/').pop();
        const endpoint = url.includes('/verification-files/') ? 'verification-files' : 'rc-files';
        const res = await adminApi.getRcFile(`/api/admin/${endpoint}/${encodeURIComponent(filename)}`);
        const objectUrl = URL.createObjectURL(res.data);
        if (tab) tab.location.href = objectUrl;
        else window.location.assign(objectUrl);
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch {
        tab?.close();
        toast.error('Document file not found. It may have been lost in a server redeploy — ask the user to re-upload.');
    }
}
