import toast from 'react-hot-toast';
import { adminApi } from '../api/index.js';

/** True when a verification/vehicle record points at an actual image. */
export function hasViewableDocument(url) {
    return /^https?:\/\//i.test(url || '') || /^\/(api\/admin\/rc-files|uploads\/rc)\//.test(url || '');
}

/**
 * Open an identity document for review. Local RC photos are admin-only, so
 * they are fetched with the admin's token and shown as a blob URL; older
 * records stored as /uploads/rc/... map to the same admin route.
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
        const res = await adminApi.getRcFile(`/api/admin/rc-files/${encodeURIComponent(filename)}`);
        const objectUrl = URL.createObjectURL(res.data);
        if (tab) tab.location.href = objectUrl;
        else window.location.assign(objectUrl);
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch {
        tab?.close();
        toast.error('Document file not found. It may have been lost in a server redeploy — ask the user to re-upload.');
    }
}
