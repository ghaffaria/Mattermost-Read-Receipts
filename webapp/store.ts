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

// Custom event for store updates
const STORE_UPDATE_EVENT = 'mattermost-readreceipts_store_update';

interface Receipt {
    message_id: string;
    user_id: string;
    timestamp: number;
}

export const loadInitialReceipts = async (channelId: string): Promise<void> => {
    console.log('🔄 [Store] Loading receipts for channel:', channelId);
    
    try {
        // Fetch receipts from API
        const response = await fetch(`/plugins/mattermost-readreceipts/api/v1/receipts?channel_id=${encodeURIComponent(channelId)}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const receipts: Receipt[] = await response.json();
        console.log('📥 [Store] Received receipts:', {
            channelId,
            count: receipts.length,
            receipts
        });

        // Group receipts by message
        const messageReceipts = new Map<string, Set<string>>();
        for (const receipt of receipts) {
            const users = messageReceipts.get(receipt.message_id) || new Set<string>();
            users.add(receipt.user_id);
            messageReceipts.set(receipt.message_id, users);
        }

        // Update receipt map
        messageReceipts.forEach((users, messageId) => {
            receiptMap.set(messageId, users);
        });

        console.log('💾 [Store] Updated receipt map:', {
            channelId,
            messageCount: messageReceipts.size,
            messages: Array.from(messageReceipts.keys())
        });

        // Dispatch event to trigger rerenders
        const event = new CustomEvent(STORE_UPDATE_EVENT, {
            detail: {
                type: 'receipts_loaded',
                channelId,
                messageCount: messageReceipts.size,
                receipts: Array.from(messageReceipts.entries()).map(([msgId, users]) => ({
                    messageId: msgId,
                    users: Array.from(users)
                }))
            }
        });

        window.dispatchEvent(event);
        
        console.log('📢 [Store] Dispatched store update event:', {
            type: 'receipts_loaded',
            channelId,
            messageCount: messageReceipts.size
        });
    } catch (error) {
        console.error('❌ [Store] Failed to load receipts:', {
            channelId,
            error
        });
        throw error;
    }
};

// Export event name for components
export const RECEIPT_STORE_UPDATE = STORE_UPDATE_EVENT;
