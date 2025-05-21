// webapp/websocket.ts


import {Dispatch} from 'redux';
import {upsertReceipt} from './store';

// Handle WebSocket events for read receipts.
export function handleWebSocketEvent(dispatch: Dispatch) {
    return (event: MessageEvent) => {
        console.log('🌐 WebSocket raw event received:', event);

        try {
            const data = JSON.parse(event.data);
            console.log('🌐 Parsed WebSocket data:', data);

            // Check if this is our plugin's event
            if (data.event === 'custom_mattermost-readreceipts_read_receipt') {
                const {message_id, user_id, timestamp} = data.data;

                console.log(`📥 Read receipt matched: message_id=${message_id}, user_id=${user_id}, time=${timestamp}`);
                console.log('🧠 Dispatching upsertReceipt to Redux...');

                dispatch(upsertReceipt({
                    messageID: message_id,
                    userID: user_id,
                }));

                console.log(`✅ Redux updated for message ${message_id} with user ${user_id}`);
            } else {
                console.log(`ℹ️ Ignored WebSocket event: ${data.event}`);
            }
        } catch (error) {
            console.error('❌ Failed to handle WebSocket event:', error);
        }
    };
}
