// webapp/websocket.ts

import { Dispatch } from 'redux';
import { updateReadReceipts, getUserDisplayName } from './store';

export function handleWebSocketEvent(dispatch: Dispatch) {
    return (event: MessageEvent) => {
        console.log('📡 [WebSocket] Raw event received:', {
            event: event.type,
            data: event.data,
            origin: event.origin
        });

        try {
            const data = JSON.parse(event.data);
            console.log('🔍 [WebSocket] Parsed event:', {
                type: data.event,
                data: data.data
            });

            if (data.event && data.event.endsWith('_read_receipt')) {
                const { message_id, user_id } = data.data;
                
                console.log('📬 [WebSocket] Processing read receipt:', {
                    messageId: message_id,
                    userId: user_id,
                    username: getUserDisplayName(user_id)
                });

                // Update local state
                updateReadReceipts(message_id, user_id);

                // Create custom event for components
                const customEvent = new CustomEvent('mattermost-websocket-event', {
                    detail: {
                        event: 'custom_mattermost-readreceipts_read_receipt',
                        data: { message_id, user_id }
                    }
                });

                console.log('🔔 [WebSocket] Dispatching event to components:', {
                    event: customEvent.type,
                    detail: customEvent.detail
                });

                window.dispatchEvent(customEvent);
            } else {
                console.log('⏭️ [WebSocket] Ignoring non-receipt event:', data.event);
            }
        } catch (error: any) {
            console.error('❌ [WebSocket] Error handling event:', {
                error: error.message,
                stack: error.stack,
                event
            });
        }
    };
}

export function initializeWebSocket() {
    console.log('🌐 [WebSocket] Initializing connection...');
    
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
}
