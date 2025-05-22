// webapp/plugin.tsx

import React from 'react';
import {PluginRegistry} from 'mattermost-webapp/plugins/registry';
import PostReceipt from './components/PostReceipt';
import {handleWebSocketEvent} from './websocket';
import {store} from './store';

export default class ReadReceiptPlugin {
    initialize(registry: PluginRegistry) {
        console.log('🧩 [ReadReceiptPlugin] Registering PostReceipt component...');
        console.log('🔌 [ReadReceiptPlugin] Registering WebSocket handler for read_receipt...');

        // استفاده درست از متد registerPostTypeComponent برای اضافه کردن PostReceipt به پست‌های معمولی (type: "")
        try {
            // بسته به نسخه Mattermost ممکن است آرگومان اول را قبول کند یا فقط کامپوننت را بخواهد.
            // اگر خطا داشتی، روش پایین (با فانکشن) را تست کن و لاگ بگیر!
            if ((registry as any).registerPostTypeComponent) {
                (registry as any).registerPostTypeComponent(
                    (props: { post: { id: string, type: string } }) => {
                        // فقط پست‌های معمولی را نمایش بده (type: "")
                        if (!props.post || props.post.type !== '') {
                            return null;
                        }
                        console.log('[ReadReceiptPlugin] Rendering PostReceipt for post:', props.post.id);
                        return <PostReceipt post={props.post} />;
                    }
                );
                console.log('✅ [ReadReceiptPlugin] PostReceipt component registered for post type "".');
            } else {
                // اگر متد نبود، لاگ بده
                console.error('❌ [ReadReceiptPlugin] registerPostTypeComponent method not found in registry.');
            }
        } catch (err) {
            console.error('❌ [ReadReceiptPlugin] Error in registerPostTypeComponent:', err);
        }

        // ثبت WebSocket Event Handler
        try {
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
