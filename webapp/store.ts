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

let mattermostStore: Store<MattermostState> | null = null;

// Use Map instead of plain object for better mutability
const receiptMap = new Map<string, Set<string>>();

// Map to store channel read states
const channelReadsMap = new Map<string, Map<string, {lastPostId: string, lastSeenAt: number}>>();

export const setMattermostStore = (store: Store<MattermostState> | null) => {
    if (!store) {
        console.error('❌ [Store] Attempted to initialize with null store');
        return;
    }
    try {
        // Validate store has expected structure
        const state = store.getState();
        if (!state?.entities?.users?.profiles) {
            console.error('❌ [Store] Invalid store structure:', state);
            return;
        }

        mattermostStore = store;
        console.log('✅ [Store] Initialized with Mattermost store:', {
            hasStore: true,
            userProfiles: Object.keys(state.entities.users.profiles).length
        });
    } catch (error) {
        console.error('❌ [Store] Failed to initialize store:', error);
    }
};

export const getMattermostStore = (): Store<MattermostState> | null => {
    if (!mattermostStore) {
        console.warn('⚠️ [Store] Attempted to access uninitialized store');
    }
    return mattermostStore;
};

export const getReadReceipts = (): Record<string, string[]> => {
    // Convert Map to plain object for API compatibility
    const receipts: Record<string, string[]> = {};
    receiptMap.forEach((users, messageId) => {
        receipts[messageId] = Array.from(users);
    });
    
    console.log('📖 [Store] Getting all read receipts:', {
        messageCount: receiptMap.size,
        messages: Array.from(receiptMap.keys())
    });
    
    return receipts;
};

export const getMessageReadReceipts = (messageId: string): string[] => {
    const users = receiptMap.get(messageId);
    return users ? Array.from(users) : [];
};

export const updateReadReceipts = (messageId: string, userId: string): void => {
    if (!messageId || !userId) {
        console.error('❌ [Store] Invalid receipt update:', { messageId, userId });
        return;
    }

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

        // Dispatch event to trigger UI updates
        const event = new CustomEvent(STORE_UPDATE_EVENT, {
            detail: {
                type: 'receipt_added',
                receipts: [{
                    messageId,
                    users: Array.from(users)
                }]
            }
        });
        window.dispatchEvent(event);
    } else {
        console.log('ℹ️ [Store] Receipt already exists:', {
            messageId,
            userId
        });
    }
};

export const getUserProfiles = (): Record<string, MattermostUser> => {
    if (!mattermostStore) {
        console.error('❌ [Store] Cannot get user profiles: store not initialized');
        return {};
    }

    const profiles = mattermostStore.getState()?.entities?.users?.profiles;
    if (!profiles) {
        console.error('❌ [Store] Cannot get user profiles: invalid store structure');
        return {};
    }

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

interface ChannelRead {
    channel_id: string;
    user_id: string;
    last_post_id: string;
    last_seen_at: number;
}

export const loadInitialReceipts = async (channelId: string): Promise<void> => {
    console.log('🔄 [Store] Loading receipts for channel:', channelId);
    
    try {
        // Fetch both receipts and channel reads in parallel
        const [receiptsResponse, readsResponse] = await Promise.all([
            fetch(
                `/plugins/mattermost-readreceipts/api/v1/receipts?channel_id=${encodeURIComponent(channelId)}&since=0`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    credentials: 'include'
                }
            ),
            fetch(
                `/plugins/mattermost-readreceipts/api/v1/channel/${encodeURIComponent(channelId)}/reads`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    credentials: 'include'
                }
            )
        ]);

        if (!receiptsResponse.ok || !readsResponse.ok) {
            throw new Error(`HTTP error! receipts: ${receiptsResponse.status}, reads: ${readsResponse.status}`);
        }

        // Process both responses
        const [messageReceipts, channelReads] = await Promise.all([
            receiptsResponse.json() as Promise<Receipt[]>,
            readsResponse.json() as Promise<ChannelRead[]>
        ]);

        console.log('📥 [Store] Received data:', {
            channelId,
            messageReceiptsCount: messageReceipts.length,
            channelReadsCount: channelReads.length
        });

        // Update channel reads map
        const channelReadersMap = new Map<string, {lastPostId: string, lastSeenAt: number}>();
        for (const read of channelReads) {
            channelReadersMap.set(read.user_id, {
                lastPostId: read.last_post_id,
                lastSeenAt: read.last_seen_at
            });
        }
        channelReadsMap.set(channelId, channelReadersMap);

        // Process message receipts
        const messageReceiptsMap = new Map<string, Set<string>>();
        for (const receipt of messageReceipts) {
            const users = messageReceiptsMap.get(receipt.message_id) || new Set<string>();
            users.add(receipt.user_id);
            messageReceiptsMap.set(receipt.message_id, users);
        }

        // Merge channel reads into message receipts
        const store = getMattermostStore() as Store<MattermostStateWithPosts> | null;
        const posts = store?.getState()?.entities?.posts?.posts || {};
        
        Object.entries(posts).forEach(([postId, post]) => {
            if (post.channel_id === channelId) {
                const existingReaders = messageReceiptsMap.get(postId) || new Set<string>();
                channelReadersMap.forEach((read, userId) => {
                    // Add user to post readers if they've read up to this post
                    if (read.lastSeenAt >= post.create_at) {
                        existingReaders.add(userId);
                    }
                });
                messageReceiptsMap.set(postId, existingReaders);
            }
        });

        // Update receipt map with merged data
        messageReceiptsMap.forEach((users, messageId) => {
            receiptMap.set(messageId, users);
        });

        console.log('💾 [Store] Updated maps:', {
            channelId,
            messageCount: messageReceiptsMap.size,
            messages: Array.from(messageReceiptsMap.keys())
        });

        // Dispatch event to trigger rerenders
        const event = new CustomEvent(STORE_UPDATE_EVENT, {
            detail: {
                type: 'receipts_loaded',
                channelId,
                messageCount: messageReceiptsMap.size,
                receipts: Array.from(messageReceiptsMap.entries()).map(([msgId, users]) => ({
                    messageId: msgId,
                    users: Array.from(users)
                }))
            }
        });

        window.dispatchEvent(event);
        
        console.log('📢 [Store] Dispatched store update event:', {
            type: 'receipts_loaded',
            channelId,
            messageCount: messageReceiptsMap.size
        });

    } catch (error) {
        console.error('❌ [Store] Failed to load channel data:', {
            channelId,
            error
        });
        throw error;
    }
};

interface Post extends Record<string, any> {
    id: string;
    channel_id: string;
    create_at: number;
    user_id: string;
}

interface MattermostStateWithPosts extends MattermostState {
    entities: {
        users: {
            profiles: Record<string, MattermostUser>;
        };
        posts: {
            posts: Record<string, Post>;
        };
    };
}

// Map to store channel read states
const channelReadMap = new Map<string, Map<string, {lastPostId: string, lastSeenAt: number}>>();

interface ChannelRead {
    channel_id: string;
    user_id: string;
    last_post_id: string;
    last_seen_at: number;
}

export const loadChannelReads = async (channelId: string): Promise<void> => {
    try {
        console.log('📖 [Store] Loading channel reads:', channelId);
        
        const response = await fetch(
            `/plugins/mattermost-readreceipts/api/v1/channel/${channelId}/reads`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'include'
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reads: ChannelRead[] = await response.json();
        
        // Initialize channel map if needed
        if (!channelReadMap.has(channelId)) {
            channelReadMap.set(channelId, new Map());
        }
        
        const channelReads = channelReadMap.get(channelId)!;
        
        // Update channel reads
        reads.forEach(read => {
            channelReads.set(read.user_id, {
                lastPostId: read.last_post_id,
                lastSeenAt: read.last_seen_at
            });
        });

        // Get posts from Mattermost store
        const store = getMattermostStore() as Store<MattermostStateWithPosts> | null;
        const posts = store?.getState()?.entities?.posts?.posts || {};

        // Update receipt map based on channel reads
        Object.entries(posts).forEach(([postId, post]) => {
            if (post.channel_id === channelId) {
                const postReaders = new Set<string>();
                channelReads.forEach((read, userId) => {
                    // Add user to post readers if they've read up to this post
                    if (read.lastSeenAt >= post.create_at) {
                        postReaders.add(userId);
                    }
                });
                receiptMap.set(postId, postReaders);
            }
        });

        console.log('✅ [Store] Channel reads loaded:', {
            channelId,
            readsCount: channelReads.size,
            updatedPosts: Array.from(receiptMap.keys())
        });

        // Trigger UI update
        const event = new CustomEvent(STORE_UPDATE_EVENT, {
            detail: {
                type: 'channel_reads_loaded',
                channelId,
                reads: Array.from(channelReads.entries()).map(([userId, read]) => ({
                    userId,
                    ...read
                }))
            }
        });
        window.dispatchEvent(event);

    } catch (error) {
        console.error('❌ [Store] Failed to load channel reads:', {
            channelId,
            error
        });
    }
};

// Export event name for components
export const RECEIPT_STORE_UPDATE = STORE_UPDATE_EVENT;

export let visibilityThresholdMs = 2000;

export async function fetchPluginConfig(): Promise<void> {
    try {
        const response = await fetch('/plugins/mattermost-readreceipts/api/v1/config');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const config = await response.json();
        if (typeof config.visibility_threshold_ms === 'number') {
            visibilityThresholdMs = config.visibility_threshold_ms;
            if (!visibilityThresholdMs) {
                visibilityThresholdMs = 2000; // Reset to default if received 0
                console.log('⚙️ [Store] Invalid threshold received, using default:', visibilityThresholdMs);
            }
            console.log('⚙️ [Store] Updated visibility threshold:', visibilityThresholdMs);
        }
    } catch (error) {
        console.error('❌ [Store] Failed to fetch plugin config:', error);
        // Keep default value on error
    }
}
