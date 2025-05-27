// Legacy store implementation maintained for backwards compatibility
import { Store } from 'redux';
import { store } from './index';
import { addReader } from './channelReaders';

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

// Custom event for store updates
export const STORE_UPDATE_EVENT = 'mattermost-readreceipts_store_update';

export const setMattermostStore = (externalStore: Store<MattermostState>) => {
    mattermostStore = externalStore;
    console.log('🔌 [Store] Initialized with Mattermost store:', {
        hasStore: !!externalStore,
        userProfiles: Object.keys(externalStore.getState().entities.users.profiles).length
    });
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

interface Receipt {
    message_id: string;
    user_id: string;
    timestamp: number;
}

export const loadInitialReceipts = async (channelId: string): Promise<void> => {
    console.log('🔄 [Store] Loading receipts for channel:', channelId);
    
    try {
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

        const { user_ids: readers } = await response.json();
        console.log('📥 [Store] Received channel readers:', {
            channelId,
            count: readers.length,
            readers
        });

        // Update Redux store
        store.dispatch(addReader({ 
            channelId, 
            postId: '*', // Special marker for channel-level reads
            userId: readers.join(',') // Temporary storage until we migrate fully
        }));

        console.log('💾 [Store] Updated Redux store:', {
            channelId,
            readerCount: readers.length
        });

        // Dispatch legacy event for backward compatibility
        const event = new CustomEvent(STORE_UPDATE_EVENT, {
            detail: {
                type: 'receipts_loaded',
                channelId,
                readerCount: readers.length
            }
        });

        window.dispatchEvent(event);
        
    } catch (error) {
        console.error('❌ [Store] Failed to load receipts:', {
            channelId,
            error
        });
        throw error;
    }
};

export interface PluginConfig {
    Enable: boolean;
    VisibilityThresholdMs: number;
    RetentionDays: number;
    LogLevel: 'debug' | 'info' | 'error';
}

export const fetchPluginConfig = async (): Promise<PluginConfig> => {
    console.log('⚙️ [Store] Fetching plugin config...');
    
    try {
        const response = await fetch('/plugins/mattermost-readreceipts/api/v1/config', {
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

        const config = await response.json();
        console.log('✅ [Store] Plugin config loaded:', config);
        return config;
    } catch (error) {
        console.error('❌ [Store] Failed to fetch plugin config:', error);
        // Return default config on error
        return {
            Enable: true,
            VisibilityThresholdMs: 2000,
            RetentionDays: 30,
            LogLevel: 'info'
        };
    }
};
