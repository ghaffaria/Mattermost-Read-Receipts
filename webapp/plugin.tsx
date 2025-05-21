// webapp/plugin.tsx

import React from 'react';
import {PluginRegistry} from 'mattermost-webapp/plugins/registry';
import PostReceipt from './components/PostReceipt';
import {handleWebSocketEvent} from './websocket';
import {store} from './store';

export default class ReadReceiptPlugin {
    initialize(registry: PluginRegistry) {
        // Register component that shows read receipt icon
        registry.registerPostTypeComponent(({post}) => (
            <PostReceipt messageId={post.id} />
        ));

        // Register WebSocket handler for receiving read_receipt events
        registry.registerWebSocketEventHandler(
            'custom_mattermost-readreceipts_read_receipt',
            handleWebSocketEvent(store.dispatch)
        );

        console.log('ReadReceiptPlugin initialized: component + WebSocket registered.');
    }
}
