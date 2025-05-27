// webapp/plugin.tsx
import React from 'react';
// @ts-ignore
import {PluginRegistry} from 'mattermost-webapp/plugins/registry';
import PostReceipt from './components/PostReceipt';
import {handleWebSocketEvent, initializeWebSocket} from './websocket';
import {setMattermostStore, loadInitialReceipts, fetchPluginConfig} from './store';
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
        
        try {
            // Set the Mattermost store reference for our plugin
            setMattermostStore(store);
            
            // Fetch plugin configuration
            await fetchPluginConfig();

            // Initialize WebSocket
            console.log('🔌 [ReadReceiptPlugin] Initializing WebSocket...');
            const socket = initializeWebSocket();
            if (!socket) {
                throw new Error('Failed to initialize WebSocket');
            }
            socket.onmessage = handleWebSocketEvent(store.dispatch);

            // Listen for channel view events
            registry.registerWebSocketEventHandler(
                'multiple_channels_viewed',
                async (message: WebSocketMessage) => {
                    const channelIds = message.data?.channel_ids;
                    if (channelIds && Array.isArray(channelIds)) {
                        console.log('👀 [ReadReceiptPlugin] Channels viewed:', channelIds);
                        for (const channelId of channelIds) {
                            try {
                                await loadInitialReceipts(channelId);
                            } catch (error) {
                                console.error('❌ [ReadReceiptPlugin] Failed to load receipts:', {
                                    channelId,
                                    error
                                });
                            }
                        }
                    }
                }
            );

            // Pre-load receipts for current channel before mounting
            try {
                const state = store.getState();
                const currentChannelId = state?.entities?.channels?.currentChannelId;
                
                if (currentChannelId) {
                    console.log('📥 [ReadReceiptPlugin] Pre-loading receipts for channel:', currentChannelId);
                    await loadInitialReceipts(currentChannelId);
                    console.log('✅ [ReadReceiptPlugin] Pre-loaded receipts successfully');
                } else {
                    console.log('ℹ️ [ReadReceiptPlugin] No active channel, skipping pre-load');
                }
            } catch (error) {
                console.error('❌ [ReadReceiptPlugin] Failed to pre-load receipts:', error);
            }

            // Register root component after pre-loading (or if pre-load fails)
            registry.registerRootComponent(ReadReceiptRootObserver);

            // Register post component with proper error handling
            try {
                if ((registry as any).registerPostTypeComponent) {
                    console.log('🧩 [ReadReceiptPlugin] Registering post component...');
                    (registry as any).registerPostTypeComponent(
                        (props: PostProps) => {
                            if (!props?.post?.id || props.post.type !== '') {
                                return null;
                            }
                            console.log('[ReadReceiptPlugin] Rendering for post:', props.post.id);
                            return <PostReceipt post={props.post} />;
                        }
                    );
                    console.log('✅ [ReadReceiptPlugin] Post component registered');
                }
            } catch (error) {
                console.error('❌ [ReadReceiptPlugin] Error in registerPostTypeComponent:', error);
            }

            // Register WebSocket handler with error handling
            try {
                console.log('🔌 [ReadReceiptPlugin] Registering WebSocket handler...');
                registry.registerWebSocketEventHandler(
                    'custom_mattermost-readreceipts_read_receipt',
                    handleWebSocketEvent(store.dispatch)
                );
                console.log('✅ [ReadReceiptPlugin] WebSocket handler registered');
            } catch (error) {
                console.error('❌ [ReadReceiptPlugin] Failed to register WebSocket handler:', error);
            }

            console.log('✅ [ReadReceiptPlugin] Initialization complete');
        } catch (error) {
            console.error('❌ [ReadReceiptPlugin] Critical initialization error:', error);
            throw error; // Re-throw to notify Mattermost of initialization failure
        }
    }
}

// Register plugin
if (window.registerPlugin) {
    window.registerPlugin('mattermost-readreceipts', new ReadReceiptPlugin());
}
