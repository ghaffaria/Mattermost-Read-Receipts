// webapp/utils/user.ts
import { getUserId } from './index';

/**
 * Gets the display name for a user, with fallbacks
 * @param userId The ID of the user to get the display name for
 * @returns The user's display name, falling back to username if full name is empty
 */
export function getUserDisplayName(userId: string): string {
    const currentUserId = getUserId();
    
    if (userId === currentUserId) {
        return 'You';
    }

    // Access Mattermost's global user store
    const user = (window as any).store.getState().entities.users.profiles[userId];
    if (!user) {
        return `User ${userId.substring(0, 6)}`;
    }

    // Prefer full name if available, otherwise use username
    return user.first_name && user.last_name 
        ? `${user.first_name} ${user.last_name}`.trim()
        : user.username;
}
