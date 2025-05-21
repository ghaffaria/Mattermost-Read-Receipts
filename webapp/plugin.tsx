// webapp/plugin.tsx

import React from 'react';
import {PluginRegistry} from 'mattermost-webapp/plugins/registry';
import PostReceipt from './components/PostReceipt';
import {handleWebSocketEvent} from './websocket';
import {store} from './store';

export default class ReadReceiptPlugin {
    initialize(registry: PluginRegistry) {
        console.log('🧩 Registering PostReceipt component...');
        console.log('🔌 Registering WebSocket handler for read_receipt...');
        // Register component that shows read receipt icon
        registry.registerPostTypeComponent(({post}) => (
            <PostReceipt messageId={post.id} />
        ));

        // Register WebSocket handler for receiving read_receipt events
        try {
            registry.registerWebSocketEventHandler(
                'custom_mattermost-readreceipts_read_receipt',
                handleWebSocketEvent(store.dispatch)
            );
            console.log('✅ WebSocket handler registered successfully.');
        } catch (error) {
            console.error('❌ Failed to register WebSocket handler:', error);
        }

        console.log('ReadReceiptPlugin initialized: component + WebSocket registered.');
    }
}
