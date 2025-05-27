// webapp/websocket.ts

import { Dispatch } from 'redux';
import { updateReadReceipts, getUserDisplayName, loadInitialReceipts } from './store';
import { setReaders, addReader } from './store/channelReaders';

interface WebSocketMessageData {
    message_id: string;
    user_id: string;
    timestamp?: number;
    channel_id?: string;
}

interface WebSocketEvent {
    event: string;
    data?: WebSocketMessageData;
    broadcast?: {
        channel_id?: string;
    };
}

const READ_RECEIPT_EVENT = 'custom_mattermost-readreceipts_read_receipt';
const CHANNEL_READERS_EVENT = 'custom_mattermost-readreceipts_channel_readers';

export function handleWebSocketEvent(dispatch: Dispatch) {
    return (payload: any) => {
        let eventName: string;
        let eventData: WebSocketMessageData | undefined;
        let broadcast: { channel_id?: string } | undefined;

        // Registry event payload
        if (typeof payload === 'object' && 'event' in payload && 'data' in payload) {
            eventName = payload.event;
            eventData = payload.data as WebSocketMessageData;
            broadcast = payload.broadcast;
        } else if (payload.data && typeof payload.data === 'string') {
            // Raw MessageEvent
            try {
                const parsed = JSON.parse(payload.data);
                eventName = parsed.event;
                eventData = parsed.data;
                broadcast = parsed.broadcast;
            } catch {
                console.error('❌ [WebSocket] Failed to parse payload.data:', payload.data);
                return;
            }
        } else {
            console.warn('⚠️ [WebSocket] Unsupported event payload:', payload);
            return;
        }

        // Handle channel readers batch update (allow prefix variations)
        if (eventName.includes('channel_readers')) {
            const data = eventData as unknown as { channel_id: string; last_post_id: string; user_ids: string[] };
            if (data.channel_id && data.last_post_id && Array.isArray(data.user_ids)) {
                dispatch(setReaders({
                    channelId: data.channel_id,
                    payload: { [data.last_post_id]: data.user_ids }
                }));
                console.log('✨ [WebSocket] Channel readers update received:', data);
            } else {
                console.error('❌ [WebSocket] Invalid channel readers data:', eventData);
            }
            return;
        }

        // Only handle read receipt events (allow suffix variations)
        if (!eventName.endsWith('read_receipt')) {
            return;
        }

        if (!eventData?.message_id || !eventData?.user_id) {
            console.error('❌ [WebSocket] Invalid read receipt data:', eventData);
            return;
        }

        const message_id = eventData.message_id;
        const user_id = eventData.user_id;
        const channel_id = eventData.channel_id || broadcast?.channel_id;

        if (!channel_id) {
            console.warn('⚠️ [WebSocket] Missing channel_id in event payload for message:', message_id);
        }

        console.log('✨ [WebSocket] Processing read receipt:', {
            message_id,
            user_id,
            channel_id,
            username: getUserDisplayName(user_id)
        });

        // Update store and trigger UI update
        updateReadReceipts(message_id, user_id);

        // Optionally reload receipts list for channel
        if (channel_id) {
            loadInitialReceipts(channel_id).catch(error => {
                console.error('❌ [WebSocket] Failed to reload receipts after event:', error);
            });
        }
    };
}

export function initializeWebSocket() {
    console.log('🔌 [WebSocket] Initializing connection...');
    
    try {
        const socket = new WebSocket('/api/v4/websocket');

        socket.onopen = () => {
            console.log('✅ [WebSocket] Connection established');
        };

        socket.onerror = (error) => {
            console.error('❌ [WebSocket] Connection error:', {
                error,
                readyState: socket.readyState
            });
        };

        socket.onclose = () => {
            console.warn('⚠️ [WebSocket] Connection closed', {
                wasClean: socket.readyState === 3,
                readyState: socket.readyState
            });
        };

        return socket;
    } catch (error) {
        console.error('❌ [WebSocket] Failed to initialize:', error);
        return null;
    }
}
