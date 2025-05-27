export const getUserId = (): string => {
    return document.cookie.match(/MMUSERID=([^;]+)/)?.[1] || window.localStorage.getItem('MMUSERID') || '';
};

export const shouldTrackVisibility = (): boolean => {
    const currentUserId = getUserId();
    // This would need to be updated based on your logic for determining if a message is from the current user
    // For now, I'm leaving it as a placeholder that always returns true
    return true;
};
