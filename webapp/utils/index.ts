// Get the current user's ID from cookie or localStorage
export const getUserId = (): string => {
    const cookieUserId = document.cookie.match(/MMUSERID=([^;]+)/)?.[1];
    const localStorageUserId = window.localStorage.getItem('MMUSERID');
    return cookieUserId || localStorageUserId || '';
};

// Helper to decide if a message's read status should be tracked
export const shouldTrackVisibility = (senderId?: string): boolean => {
    const currentUserId = getUserId();
    if (!currentUserId) {
        return false; // Don't track if we can't identify the user
    }
    if (!senderId) {
        return true; // If no sender ID provided, just check if we have a user ID
    }
    return currentUserId !== senderId; // Don't track read receipts for own messages
};
