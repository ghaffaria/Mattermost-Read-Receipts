// webapp/plugin.tsx
import React from 'react';
// @ts-ignore
import {PluginRegistry} from 'mattermost-webapp/plugins/registry';
import PostReceipt from './components/PostReceipt';
import {handleWebSocketEvent, initializeWebSocket} from './websocket';
import {setMattermostStore, loadInitialReceipts} from './store';
import ReadReceiptRootObserver from './components/ReadReceiptRootObserver';

interface WebSocketMessage {
    event: string;
    data: {
        channel_ids?: string[];
    };
}

declare global {
    interface Window {
        store: any;
    }
}

import { Post } from './types/mattermost-webapp';

interface PostProps {
    post: Post;
}

export default class ReadReceiptPlugin {
    async initialize(registry: PluginRegistry, store: any) {
        console.log('🔌 [ReadReceiptPlugin] Initializing...');
        
        // Set the Mattermost store reference for our plugin
        setMattermostStore(store);
        
        // Initialize WebSocket
        console.log('🔌 [ReadReceiptPlugin] Initializing WebSocket...');
        const socket = initializeWebSocket();
        socket.onmessage = handleWebSocketEvent(store.dispatch);

        // Listen for channel view events
        registry.registerWebSocketEventHandler(
            'multiple_channels_viewed',
            async (message: WebSocketMessage) => {
                const channelIds = message.data?.channel_ids;
                if (channelIds && Array.isArray(channelIds)) {
                    console.log('👀 [ReadReceiptPlugin] Channels viewed:', channelIds);
                    channelIds.forEach(channelId => {
                        loadInitialReceipts(channelId).catch(error => {
                            console.error('❌ [ReadReceiptPlugin] Failed to load receipts:', {
                                channelId,
                                error
                            });
                        });
                    });
                }
            });

        // Pre-load receipts for current channel before mounting
        try {
            const state = store.getState();
            const currentChannelId = state?.entities?.channels?.currentChannelId;
            
            if (currentChannelId) {
                console.log('📥 [ReadReceiptPlugin] Pre-loading receipts for channel:', currentChannelId);
                await loadInitialReceipts(currentChannelId).catch(error => {
                    console.error('❌ [ReadReceiptPlugin] Failed to pre-load receipts:', error);
                });
                console.log('✅ [ReadReceiptPlugin] Pre-loaded receipts successfully');
            } else {
                console.log('ℹ️ [ReadReceiptPlugin] No active channel, skipping pre-load');
            }
        } catch (error) {
            console.error('❌ [ReadReceiptPlugin] Failed to pre-load receipts:', error);
        }

        // Register root component after pre-loading (or if pre-load fails)
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
