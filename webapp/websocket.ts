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
                const { message_id, user_id, timestamp } = data.data;

                console.log(`📥 [websocket] Read receipt matched: message_id=${message_id}, user_id=${user_id}, time=${timestamp}`);
                console.log('🧠 [websocket] Dispatching upsertReceipt to Redux...');

                dispatch(upsertReceipt({
                    messageID: message_id,
                    userID: user_id,
                }));

                // نمایش state پس از dispatch
                setTimeout(() => {
                    try {
                        console.log('🔎 [websocket] Redux state after update:', store.getState());
                    } catch (e) {
                        console.warn('⚠️ [websocket] Store inspect failed:', e);
                    }
                }, 10);

                console.log(`✅ [websocket] Redux updated for message ${message_id} with user ${user_id}`);
            } else {
                console.log(`ℹ️ [websocket] Ignored WebSocket event: ${data.event}`);
            }
        } catch (error: any) {
            console.error('❌ [websocket] Failed to handle WebSocket event:', error?.stack || error);
        }
    };
}
