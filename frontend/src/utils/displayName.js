/**
 * Label for a person in lists — show "You" for the logged-in user.
 */
export function displayName(name, personId, currentUserId, fallback = 'Member') {
    if (personId && currentUserId && personId === currentUserId) return 'You';
    return name || fallback;
}
