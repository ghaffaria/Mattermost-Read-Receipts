// webapp/websocket.ts

import { Dispatch } from 'redux';
import { updateReadReceipts, getUserDisplayName } from './store';
import { setReaders, addReader } from './store/channelReaders';

const READ_RECEIPT_EVENT = 'custom_mattermost-readreceipts_read_receipt';
const CHANNEL_READERS_EVENT = 'custom_mattermost-readreceipts_channel_readers';

// Maximum number of reconnection attempts
const MAX_RECONNECT_ATTEMPTS = 5;
// Initial reconnect delay in milliseconds
const INITIAL_RECONNECT_DELAY = 1000;

function getWebSocketUrl(): string {
    // Try to get MMUSERID first, then fall back to MMTOKEN
    const userIdMatch = document.cookie.match(/MMUSERID=([^;]+)/);
    const tokenMatch = document.cookie.match(/MMTOKEN=([^;]+)/);
    const token = userIdMatch?.[1] || tokenMatch?.[1] || '';
    
    // Use current origin to construct WebSocket URL
    const baseUrl = window.location.origin.replace(/^http/, 'ws');
    const pluginId = (window as any).plugins?.['mattermost-readreceipts']?.id || 'mattermost-readreceipts';
    
    return `${baseUrl}/plugins/${pluginId}/api/v1/websocket?token=${token}`;
}

// Track WebSocket connection globally
let globalWebSocket: WebSocket | null = null;

// Explicitly export the WebSocket event handler factory
export function handleWebSocketEvent(dispatch: Dispatch) {
    return function(event: MessageEvent) {
        try {
            const rawData = event.data;
            // Log raw data for debugging
            console.log('DEBUG: [WebSocket] Raw event data received on Ali (sender) client:', rawData);
            const eventData = JSON.parse(rawData);
            const eventName = eventData?.event || '';

            // Log all received events for debugging (Ali's client)
            console.log('DEBUG: [WebSocket] Event received on Ali (sender) client:', { eventName, eventData });

            if (!eventData) {
                console.warn('⚠️ [WebSocket] Empty event received');
                return;
            }

            // Handle channel readers updates
            if (eventName.includes('channel_readers')) {
                const data = eventData as unknown as { ChannelID: string; LastPostID: string; UserIDs: string[] };
                if (data.ChannelID && data.LastPostID && Array.isArray(data.UserIDs)) {
                    // Log before dispatching setReaders
                    console.log('DEBUG: [WebSocket] Dispatching setReaders on Ali (sender) client:', { channelId: data.ChannelID, payload: { [data.LastPostID]: data.UserIDs } });
                    dispatch(setReaders({
                        channelId: data.ChannelID,
                        payload: { [data.LastPostID]: data.UserIDs }
                    }));
                    console.log('✨ [WebSocket] Channel readers update received:', data);
                } else {
                    console.error('❌ [WebSocket] Invalid channel readers data:', eventData);
                }
                return;
            }

            // Handle read receipt events
            if (eventName.endsWith('read_receipt')) {
                if (!eventData?.MessageID || !eventData?.UserID) {
                    console.error('❌ [WebSocket] Invalid read receipt data:', eventData);
                    return;
                }

                const { MessageID: message_id, UserID: user_id, ChannelID: channel_id } = eventData;
                console.log('✨ [WebSocket] Processing read receipt:', {
                    message_id,
                    user_id,
                    channel_id,
                    username: getUserDisplayName(user_id)
                });
                // Log before dispatching addReader
                console.log('DEBUG: [WebSocket] Dispatching addReader on Ali (sender) client:', { channelId: channel_id || '', postId: message_id, userId: user_id });
                updateReadReceipts(message_id, user_id);
                dispatch(addReader({ 
                    channelId: channel_id || '',
                    postId: message_id,
                    userId: user_id
                }));
            }
        } catch (error) {
            console.error('❌ [WebSocket] Error processing message:', error);
        }
    };
}

export function setupWebsocket(dispatch: Dispatch): Promise<void> {
    return new Promise((resolve, reject) => {
        let reconnectAttempts = 0;
        let reconnectTimeout: number | null = null;

        function cleanup() {
            if (globalWebSocket) {
                try {
                    globalWebSocket.close();
                } catch (error) {
                    console.warn('⚠️ [WebSocket] Error closing connection:', error);
                }
                globalWebSocket = null;
            }
            if (reconnectTimeout) {
                window.clearTimeout(reconnectTimeout);
                reconnectTimeout = null;
            }
        }

        function connect() {
            cleanup();

            try {
                const url = getWebSocketUrl();
                console.log('🔌 [WebSocket] Connecting to:', url);
                
                globalWebSocket = new WebSocket(url);
                const ws = globalWebSocket;

                ws.addEventListener('open', () => {
                    console.log('✅ [WebSocket] Connection established');
                    reconnectAttempts = 0;
                    resolve();
                });

                ws.addEventListener('message', (event) => {
                    try {
                        const handler = handleWebSocketEvent(dispatch);
                        handler(event);
                    } catch (error) {
                        console.error('❌ [WebSocket] Error handling message:', error);
                    }
                });

                ws.addEventListener('error', (error) => {
                    console.error('❌ [WebSocket] Connection error:', error);
                    if (reconnectAttempts === 0) {
                        reject(error);
                    }
                });

                ws.addEventListener('close', (event) => {
                    console.warn('⚠️ [WebSocket] Connection closed:', {
                        code: event.code,
                        reason: event.reason || 'No reason provided',
                        wasClean: event.wasClean
                    });

                    // Attempt to reconnect if it wasn't a clean close
                    if (!event.wasClean && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                        const delay = Math.min(INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts), 30000);
                        console.log(`🔄 [WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);
                        
                        if (reconnectTimeout) {
                            window.clearTimeout(reconnectTimeout);
                        }
                        
                        reconnectTimeout = window.setTimeout(() => {
                            reconnectAttempts++;
                            connect();
                        }, delay);
                    }
                });

            } catch (error) {
                console.error('❌ [WebSocket] Setup error:', error);
                reject(error);
            }
        }

        // Start initial connection
        connect();

        // Cleanup on window unload
        window.addEventListener('unload', cleanup);
    });
}
