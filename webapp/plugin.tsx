// webapp/plugin.tsx
import React from 'react';
import {PluginRegistry} from 'mattermost-webapp/plugins/registry';
import PostReceipt from './components/PostReceipt';
import {handleWebSocketEvent, initializeWebSocket} from './websocket';
import {setMattermostStore} from './store';
import ReadReceiptRootObserver from './components/ReadReceiptRootObserver';

declare global {
    interface Window {
        store: any;
        registerPlugin?: (id: string, plugin: any) => void;
    }
}

interface Post {
    id: string;
    type: string;
}

interface PostProps {
    post: Post;
}

export default class ReadReceiptPlugin {
    initialize(registry: PluginRegistry, store: any) {
        console.log('🔌 [ReadReceiptPlugin] Initializing...');
        
        // Set the Mattermost store reference for our plugin
        setMattermostStore(store);
        
        // Initialize WebSocket
        console.log('🔌 [ReadReceiptPlugin] Initializing WebSocket...');
        const socket = initializeWebSocket();
        socket.onmessage = handleWebSocketEvent(store.dispatch);

        // Register root component
        registry.registerRootComponent(ReadReceiptRootObserver);

        // Register post component
        try {
            if ((registry as any).registerPostTypeComponent) {
                console.log('🧩 [ReadReceiptPlugin] Registering post component...');
                (registry as any).registerPostTypeComponent(
                    (props: PostProps) => {
                        if (!props.post?.id || props.post.type !== '') {
                            return null;
                        }
                        console.log('[ReadReceiptPlugin] Rendering for post:', props.post.id);
                        return <PostReceipt post={props.post} />;
                    }
                );
                console.log('✅ [ReadReceiptPlugin] Post component registered');
            }
        } catch (err) {
            console.error('❌ [ReadReceiptPlugin] Error in registerPostTypeComponent:', err);
        }

        // Register WebSocket handler
        try {
            console.log('🔌 [ReadReceiptPlugin] Registering WebSocket handler...');
            registry.registerWebSocketEventHandler(
                'custom_mattermost-readreceipts_read_receipt',
                handleWebSocketEvent(store.dispatch)
            );
            console.log('✅ [ReadReceiptPlugin] WebSocket handler registered');
        } catch (error: any) {
            console.error('❌ [ReadReceiptPlugin] Failed to register WebSocket handler:', error);
        }

        console.log('✅ [ReadReceiptPlugin] Initialization complete');
    }
}

// Register plugin
if (window.registerPlugin) {
    window.registerPlugin('mattermost-readreceipts', new ReadReceiptPlugin());
}
