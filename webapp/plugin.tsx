// webapp/plugin.tsx
import React from 'react';
// @ts-ignore
import {PluginRegistry} from 'mattermost-webapp/plugins/registry';
import PostReceipt from './components/PostReceipt';
import {handleWebSocketEvent, setupWebsocket} from './websocket';
import {loadInitialReceipts, fetchPluginConfig, loadChannelReads} from './store';
import { store, setMattermostStore } from './store/pluginStore';
import { ErrorBoundary } from './components/ErrorBoundary';
import ReadReceiptRootObserver from './components/ReadReceiptRootObserver';
import { Provider } from 'react-redux';
import { Post } from './types/mattermost-webapp';

interface PostProps {
    post: Post;
}

export default class ReadReceiptPlugin {
    async initialize(registry: PluginRegistry, mattermostStore: any) {
        console.log('🔌 [ReadReceiptPlugin] Initializing...');
        
        try {
            if (!mattermostStore?.getState) {
                console.error('❌ [ReadReceiptPlugin] Invalid Mattermost store:', mattermostStore);
                throw new Error('Invalid Mattermost store provided');
            }

            // Initialize Redux store first
            await setMattermostStore(mattermostStore);
            
            // Pre-load initial data to populate Redux store
            const state = mattermostStore.getState();
            const currentChannelId = state?.entities?.channels?.currentChannelId;
            
            // Initialize WebSocket and fetch plugin configuration in parallel
            const [config] = await Promise.all([
                fetchPluginConfig(),
                setupWebsocket(store.dispatch) // Use our store's dispatch
            ]);

            // Pre-load receipts for current channel if available
            if (currentChannelId) {
                console.log('📥 [ReadReceiptPlugin] Pre-loading receipts for channel:', currentChannelId);
                await Promise.all([
                    loadInitialReceipts(currentChannelId, store.dispatch),
                    loadChannelReads(currentChannelId)
                ]);
                console.log('✅ [ReadReceiptPlugin] Pre-loaded receipts successfully');
            }

            // Register wrapped root component
            registry.registerRootComponent(() => (
                <ErrorBoundary>
                    <Provider store={store}>
                        <ReadReceiptRootObserver />
                    </Provider>
                </ErrorBoundary>
            ));

            // Register post component with error boundary
            try {
                if ((registry as any).registerPostTypeComponent) {
                    console.log('🧩 [ReadReceiptPlugin] Registering post component...');
                    (registry as any).registerPostTypeComponent(
                        (props: PostProps) => {
                            if (!props?.post?.id || props.post.type !== '') {
                                return null;
                            }
                            console.log('[ReadReceiptPlugin] Rendering for post:', props.post.id);
                            return (
                                <ErrorBoundary>
                                    <Provider store={store}>
                                        <PostReceipt post={props.post} />
                                    </Provider>
                                </ErrorBoundary>
                            );
                        }
                    );
                    console.log('✅ [ReadReceiptPlugin] Post component registered');
                }
            } catch (error) {
                console.error('❌ [ReadReceiptPlugin] Error in registerPostTypeComponent:', error);
            }

            // Register WebSocket handler
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
            throw error;
        }
    }
}

// Register plugin
if (window.registerPlugin) {
    window.registerPlugin('mattermost-readreceipts', new ReadReceiptPlugin());
}
