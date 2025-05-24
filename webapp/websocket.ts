// webapp/websocket.ts

import { Dispatch } from 'redux';
import { upsertReceipt, store } from './store';

// Handle WebSocket events for read receipts.
export function handleWebSocketEvent(dispatch: Dispatch) {
    return (event: MessageEvent) => {
        console.log('🌐 [websocket] Raw event received:', event);

        try {
            const data = JSON.parse(event.data);
            console.log('🌐 [websocket] Parsed data:', data);

            // Check if this is our plugin's event
            if (data.event === 'custom_mattermost-readreceipts_read_receipt') {
                const { message_id, user_id } = data.data;

                console.log(`📥 [websocket] Processing read receipt event: message_id=${message_id}, user_id=${user_id}`);

                // Dispatch to Redux store
                dispatch(upsertReceipt({
                    messageID: message_id,
                    userID: user_id,
                }));

                console.log(`✅ [websocket] Redux updated for message ${message_id} with user ${user_id}`);
            } else {
                console.log(`ℹ️ [websocket] Ignored WebSocket event: ${data.event}`);
            }
        } catch (error: any) {
            console.error('❌ [websocket] Failed to handle WebSocket event:', error?.stack || error);
        }
    };
}

// Listen for WebSocket events
export function initializeWebSocket() {
    const socket = new WebSocket('/api/v4/websocket');

    socket.onmessage = handleWebSocketEvent(store.dispatch);

    socket.onopen = () => {
        console.log('🌐 [websocket] Connection established');
    };

    socket.onerror = (error) => {
        console.error('❌ [websocket] Connection error:', error);
    };

    socket.onclose = () => {
        console.warn('⚠️ [websocket] Connection closed');
    };
}
