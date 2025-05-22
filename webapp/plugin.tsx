
// webapp/plugin.tsx
console.log("🔥 mattermost-readreceipts webapp bundle loaded!plugin.tsx!");

import React from 'react';
import {PluginRegistry} from 'mattermost-webapp/plugins/registry';
import PostReceipt from './components/PostReceipt';
import {handleWebSocketEvent} from './websocket';
import {store} from './store';
import ReadReceiptRootObserver from './components/ReadReceiptRootObserver';

export default class ReadReceiptPlugin {
    initialize(registry: PluginRegistry) {
        console.log('🚀 [ReadReceiptPlugin] initialize() called with registry:', registry);
        // @ts-ignore

        registry.registerRootComponent(ReadReceiptRootObserver);

        // ثبت کامپوننت برای هر پست
        try {
            if ((registry as any).registerPostTypeComponent) {
                console.log('🧩 [ReadReceiptPlugin] registerPostTypeComponent موجود است.');
                (registry as any).registerPostTypeComponent(
                    (props: { post: { id: string, type: string } }) => {
                        console.log('[ReadReceiptPlugin] registerPostTypeComponent called for post:', props.post);
                        if (!props.post) {
                            console.warn('[ReadReceiptPlugin] props.post is null or undefined!');
                            return null;
                        }
                        if (props.post.type !== '') {
                            console.log('[ReadReceiptPlugin] Skipping non-standard post type:', props.post.type, props.post.id);
                            return null;
                        }
                        console.log('[ReadReceiptPlugin] Rendering PostReceipt for post:', props.post.id);
                        return <PostReceipt post={props.post} />;
                    }
                );
                console.log('✅ [ReadReceiptPlugin] PostReceipt component registered.');
            } else {
                console.error('❌ [ReadReceiptPlugin] registerPostTypeComponent not found!');
            }
        } catch (err) {
            console.error('❌ [ReadReceiptPlugin] Error in registerPostTypeComponent:', err);
        }

        // ثبت WebSocket Event Handler
        try {
            console.log('🔌 [ReadReceiptPlugin] Registering WebSocket handler for custom_mattermost-readreceipts_read_receipt...');
            registry.registerWebSocketEventHandler(
                'custom_mattermost-readreceipts_read_receipt',
                handleWebSocketEvent(store.dispatch)
            );
            console.log('✅ [ReadReceiptPlugin] WebSocket handler registered successfully.');
        } catch (error: any) {
            console.error('❌ [ReadReceiptPlugin] Failed to register WebSocket handler:', error, error?.stack || '');
        }

        console.log('⚡ [ReadReceiptPlugin] Plugin initialized: PostReceipt component + WebSocket registered.');
    }
}

// @ts-ignore

window.registerPlugin && window.registerPlugin('mattermost-readreceipts', new ReadReceiptPlugin());
