// webapp/websocket.ts

import { Dispatch } from 'redux';
import { updateReadReceipts, getUserDisplayName } from './store';
import { setReaders, addReader } from './store/channelReaders';

const READ_RECEIPT_EVENT = 'custom_mattermost-readreceipts_read_receipt';
const CHANNEL_READERS_EVENT = 'custom_mattermost-readreceipts_channel_readers';

// Handle WebSocket events from Mattermost's native WebSocket system
export function handleWebSocketEvent(dispatch: Dispatch) {
    return function(event: any) {
        try {
            console.log('🚀 [WebSocket] Native Mattermost event received:', event);
            console.log('🚀 [WebSocket] Event type:', typeof event, 'Keys:', Object.keys(event || {}));
            
            // Mattermost's native WebSocket events have a different structure
            // event.event is the event type, event.data contains the payload
            const eventType = event.event;
            const eventData = event.data || {};

            console.log('🔍 [WebSocket] Processing event:', { eventType, eventData });
            
            // Add extra logging to help debug
            if (eventType === READ_RECEIPT_EVENT || eventType === CHANNEL_READERS_EVENT) {
                console.log('🎯 [WebSocket] Matched our event type!', eventType);
            } else {
                console.log('📡 [WebSocket] Event type does not match our handlers:', eventType);
                console.log('📡 [WebSocket] Expected events:', { READ_RECEIPT_EVENT, CHANNEL_READERS_EVENT });
                return; // Early return for non-matching events
            }

            // Handle channel readers updates
            if (eventType === CHANNEL_READERS_EVENT) {
                const { ChannelID, LastPostID, UserIDs } = eventData;
                console.log('📊 [WebSocket] Channel readers event data:', { ChannelID, LastPostID, UserIDs });
                if (ChannelID && LastPostID && Array.isArray(UserIDs)) {
                    console.log('✅ [WebSocket] Dispatching setReaders:', { 
                        channelId: ChannelID, 
                        payload: { [LastPostID]: UserIDs } 
                    });
                    dispatch(setReaders({
                        channelId: ChannelID,
                        payload: { [LastPostID]: UserIDs }
                    }));
                    console.log('✨ [WebSocket] Channel readers update processed successfully');
                } else {
                    console.error('❌ [WebSocket] Invalid channel readers data:', eventData);
                }
                return;
            }

            // Handle read receipt events
            if (eventType === READ_RECEIPT_EVENT) {
                const { MessageID, UserID, ChannelID } = eventData;
                console.log('📩 [WebSocket] Read receipt event data:', { MessageID, UserID, ChannelID });
                if (!MessageID || !UserID) {
                    console.error('❌ [WebSocket] Invalid read receipt data:', eventData);
                    return;
                }

                console.log('✅ [WebSocket] Processing read receipt:', {
                    MessageID,
                    UserID,
                    ChannelID,
                    username: getUserDisplayName(UserID)
                });
                
                console.log('📤 [WebSocket] Dispatching addReader:', { 
                    channelId: ChannelID || '', 
                    postId: MessageID, 
                    userId: UserID 
                });
                
                updateReadReceipts(MessageID, UserID);
                dispatch(addReader({ 
                    channelId: ChannelID || '',
                    postId: MessageID,
                    userId: UserID
                }));
                console.log('✨ [WebSocket] Read receipt processed successfully');
            }
        } catch (error) {
            console.error('❌ [WebSocket] Error processing native event:', error);
        }
    };
}
