import toast from 'react-hot-toast';

/** WhatsApp share URL that works on phones (app) and desktop (web). */
export const whatsappUrl = (text) => `https://wa.me/?text=${encodeURIComponent(text)}`;

/**
 * Share a link: the native share sheet on phones, WhatsApp otherwise.
 * Returns once the sheet/tab is opened (or the user cancels).
 */
export async function shareLink({ title, text, url }) {
    if (typeof navigator !== 'undefined' && navigator.share) {
        try {
            await navigator.share({ title, text, url });
            return;
        } catch (err) {
            if (err?.name === 'AbortError') return; // user closed the sheet
        }
    }
    window.open(whatsappUrl(`${text}\n${url}`), '_blank', 'noopener');
}

export async function copyLink(url, message = 'Link copied') {
    try {
        await navigator.clipboard.writeText(url);
        toast.success(message);
    } catch {
        window.prompt('Copy this link:', url);
    }
}
