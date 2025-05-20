import {Dispatch} from 'redux';
import {addReadReceipt} from './index';

// Handle WebSocket events for read receipts.
export function handleWebSocketEvent(dispatch: Dispatch) {
    return (event: MessageEvent) => {
        try {
            const data = JSON.parse(event.data);

            // Check if the event is a read_receipt event.
            if (data.event === 'read_receipt') {
                const {message_id, user_id, timestamp} = data.data;

                // Dispatch the action to update the Redux store.
                dispatch(addReadReceipt({
                    messageID: message_id,
                    userID: user_id,
                }));

                console.log(`Read receipt received: message_id=${message_id}, user_id=${user_id}, timestamp=${timestamp}`);
            }
        } catch (error) {
            console.error('Failed to handle WebSocket event:', error);
        }
    };
}
