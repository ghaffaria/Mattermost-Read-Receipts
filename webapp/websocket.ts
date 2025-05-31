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
            // DEEP INSPECTION: Ultra-raw event logging for Ali's client
            console.log('噫 [WebSocket] RAW Native Event Received (Full Object):', event);
            
            // Deep inspect event structure
            if (event) {
                console.log('噫 [WebSocket] Event Object Keys:', Object.keys(event));
                console.log('噫 [WebSocket] RAW Event Type:', event.event);
                if (event.data) {
                    console.log('噫 [WebSocket] RAW Event Data:', JSON.stringify(event.data, null, 2));
                    console.log('噫 [WebSocket] Event Data Keys:', Object.keys(event.data));
                }
                
                // Extra inspection for our custom events
                if (event.event === 'custom_mattermost-readreceipts_read_receipt' || 
                    event.event === 'custom_mattermost-readreceipts_channel_readers') {
                    console.log('⭐ [WebSocket] CRITICAL - Our Custom Event Detected:', {
                        eventType: event.event,
                        fullData: event.data,
                        hasMessageID: event.data?.MessageID || event.data?.LastPostID,
                        hasUserID: event.data?.UserID || (Array.isArray(event.data?.UserIDs) ? 'array' : 'missing'),
                        hasChannelID: event.data?.ChannelID,
                        timestamp: new Date().toISOString()
                    });
                }
            }

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
                        // REDUX TRACE: Channel Readers Event
                        const actionPayload = {
                            channelId: ChannelID,
                            payload: { [LastPostID]: UserIDs }
                        };
                        console.log('識 [Redux Trace] Channel Readers Event:', {
                            eventType: CHANNEL_READERS_EVENT,
                            actionType: 'channelReaders/setReaders',
                            payload: actionPayload,
                            timestamp: new Date().toISOString()
                        });

                        // Dispatch with tracing
                        console.log('識 [Redux] Pre-dispatch state check for channel:', ChannelID, 'post:', LastPostID);
                        dispatch(setReaders(actionPayload));
                        console.log('識 [Redux] Post-dispatch completed for channel readers, payload:', actionPayload);
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

                    // REDUX TRACE: Read Receipt Event - Pre-dispatch state
                    const actionPayload = {
                        channelId: ChannelID || '',
                        postId: MessageID,
                        userId: UserID,
                        // Check if channel type is DM
                        isDM: (window as any).store?.getState()?.entities?.channels?.channels?.[ChannelID]?.type === 'D'
                    };
                    console.log('識 [Redux Trace] Read Receipt Event:', {
                        eventType: READ_RECEIPT_EVENT,
                        actionType: 'channelReaders/addReader',
                        payload: actionPayload,
                        username: getUserDisplayName(UserID),
                        timestamp: new Date().toISOString()
                    });

                    // Update internal store first
                    console.log('識 [Redux] Calling updateReadReceipts before dispatch');
                    updateReadReceipts(MessageID, UserID);

                    // Dispatch with tracing
                    console.log('識 [Redux] Pre-dispatch state check for message:', MessageID);
                    dispatch(addReader(actionPayload));
                    console.log('識 [Redux] Post-dispatch completed for read receipt, payload:', actionPayload);
                    console.log('✨ [WebSocket] Read receipt processed successfully');
                }
            } catch (error) {
                console.error('❌ [WebSocket] Error processing native event:', error);
            }
        } finally {
            // --- ULTRA-RAW LOGGING: Log after all processing, regardless of errors ---
            console.log('🚀 [WebSocket] RAW Native Mattermost event processed (END):', JSON.stringify(event));
        }
    };
}
