// webapp/plugin.tsx

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

        // ✅ Inject فقط برای پست‌هایی با type برابر "" (پست‌های معمولی)
        registry.registerPostTypeComponent(((props: { post: { id: string; type: string } }) => {
            const postId = props.post?.id;
            const postType = props.post?.type;

            console.log('🧪 Attempting to inject PostReceipt:');
            console.log('   🔹 postId:', postId);
            console.log('   🔹 postType:', postType);

            if (!props.post || postType !== '') {
                console.log('   ⚠️ Skipping PostReceipt: type mismatch or missing post.');
                return null;
            }

            console.log('   ✅ Injecting PostReceipt for postId:', postId);
            return <PostReceipt post={props.post} />;
        }) as any);

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
