// webapp/plugin.tsx

import React from 'react';
import {PluginRegistry} from 'mattermost-webapp/plugins/registry';
import PostReceipt from './components/PostReceipt';
import {handleWebSocketEvent} from './websocket';
import {store} from './store';
import PostObserver from './components/PostObserver';

export default class ReadReceiptPlugin {
    initialize(registry: PluginRegistry) {
        console.log('🧩 Registering PostReceipt component...');
        console.log('🔌 Registering WebSocket handler for read_receipt...');

        // ✅ ثبت کامپوننت برای تمام پست‌های معمولی (type: "")
        (registry as any).registerComponentForPostType('', PostReceipt);
        (registry as any).registerRootComponent(PostObserver);

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
