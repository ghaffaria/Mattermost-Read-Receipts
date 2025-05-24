// webapp/store.ts

import { Store } from 'redux';

export interface MattermostUser {
    id: string;
    username: string;
    first_name?: string;
    last_name?: string;
    nickname?: string;
}

interface MattermostState {
    entities: {
        users: {
            profiles: Record<string, MattermostUser>;
        };
    };
}

let mattermostStore: Store<MattermostState>;

// Use Map instead of plain object for better mutability
const receiptMap = new Map<string, Set<string>>();

export const setMattermostStore = (store: Store<MattermostState>) => {
    mattermostStore = store;
    console.log('🔌 [Store] Initialized with Mattermost store:', {
        hasStore: !!store,
        userProfiles: Object.keys(store.getState().entities.users.profiles).length
    });
};

export const getReadReceipts = (): Record<string, string[]> => {
    // Convert Map to plain object for API compatibility
    const receipts: Record<string, string[]> = {};
    receiptMap.forEach((users, messageId) => {
        receipts[messageId] = Array.from(users);
    });
    
    console.log('📖 [Store] Getting all read receipts:', {
        messageCount: receiptMap.size,
        messages: Array.from(receiptMap.keys()),
        state: receipts
    });
    
    return receipts;
};

export const getMessageReadReceipts = (messageId: string): string[] => {
    const users = receiptMap.get(messageId);
    const receipts = users ? Array.from(users) : [];
    
    console.log('👀 [Store] Getting receipts for message:', {
        messageId,
        receipts,
        allMessages: Array.from(receiptMap.keys())
    });
    
    return receipts;
};

export const updateReadReceipts = (messageId: string, userId: string): void => {
    console.log('✏️ [Store] Updating receipts:', {
        messageId,
        userId,
        beforeState: receiptMap.get(messageId)
    });

    if (!receiptMap.has(messageId)) {
        receiptMap.set(messageId, new Set());
    }

    const users = receiptMap.get(messageId)!;
    const wasAdded = !users.has(userId);
    users.add(userId);

    if (wasAdded) {
        console.log('✅ [Store] Receipt added:', {
            messageId,
            userId,
            afterState: Array.from(users)
        });
    } else {
        console.log('ℹ️ [Store] Receipt already exists:', {
            messageId,
            userId
        });
    }
};

export const getUserProfiles = (): Record<string, MattermostUser> => {
    const profiles = mattermostStore.getState().entities.users.profiles;
    console.log('👥 [Store] Getting user profiles:', {
        count: Object.keys(profiles).length,
        users: Object.keys(profiles).map(id => ({
            id,
            username: profiles[id].username
        }))
    });
    return profiles;
};

export const getUserDisplayName = (userId: string): string => {
    const profiles = getUserProfiles();
    const user = profiles[userId];
    if (!user) {
        console.warn('⚠️ [Store] User profile not found:', userId);
        return userId;
    }

    const displayName = user.nickname || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;
    console.log('👤 [Store] Getting display name:', {
        userId,
        displayName,
        user
    });
    return displayName;
};
