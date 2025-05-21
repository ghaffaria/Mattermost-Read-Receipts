// webapp/websocket.ts


import {Dispatch} from 'redux';
import {upsertReceipt} from './store';

// Handle WebSocket events for read receipts.
export function handleWebSocketEvent(dispatch: Dispatch) {
    return (event: MessageEvent) => {
        try {
            const data = JSON.parse(event.data);

            // Check if this is our plugin's event
            if (data.event === 'custom_mattermost-readreceipts_read_receipt') {
                const {message_id, user_id, timestamp} = data.data;

                dispatch(upsertReceipt({
                    messageID: message_id,
                    userID: user_id,
                }));

                console.log(`🔔 Read receipt received: msg=${message_id}, user=${user_id}, time=${timestamp}`);
            }
        } catch (error) {
            console.error('❌ Failed to handle WebSocket event:', error);
        }
    };
}
