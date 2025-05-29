// webapp/plugin.tsx
import React from 'react';
// @ts-ignore
import {PluginRegistry} from 'mattermost-webapp/plugins/registry';
import PostReceipt from './components/PostReceipt';
import {handleWebSocketEvent} from './websocket';
import {loadInitialReceipts, fetchPluginConfig, loadChannelReads} from './store';
import { ensureChannelReadsOnSwitch } from './store/index';
import { store as pluginGlobalStoreInstance, setMattermostStore, isStoreInitialized } from './store/pluginStore';
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
        console.log('DEBUG: Top-level pluginGlobalStoreInstance:', pluginGlobalStoreInstance);
        try {
            console.log('DEBUG: Calling setMattermostStore with:', mattermostStore);
            if (!mattermostStore?.getState) {
                console.error('❌ [ReadReceiptPlugin] Invalid Mattermost store:', mattermostStore);
                throw new Error('Invalid Mattermost store provided');
            }

            // Initialize Redux store first and wait for it to complete
            await setMattermostStore(mattermostStore);
            // Ensure channel reads are loaded on channel switch (one-time, after store is ready)
            ensureChannelReadsOnSwitch(mattermostStore);

            // Only proceed if store is properly initialized
            if (!isStoreInitialized()) {
                throw new Error('Store failed to initialize properly');
            }

            // Pre-load initial data to populate Redux store
            const state = mattermostStore.getState();
            const currentChannelId = state?.entities?.channels?.currentChannelId;
            
            // Initialize WebSocket and fetch plugin configuration in parallel
            const [config] = await Promise.all([
                fetchPluginConfig().catch(err => {
                    console.error('❌ [ReadReceiptPlugin] Failed to fetch config:', err);
                    return { visibilityThresholdMs: 2000 };
                })
            ]);

            // Pre-load receipts for current channel if available
            if (currentChannelId) {
                console.log('📥 [ReadReceiptPlugin] Pre-loading receipts for channel:', currentChannelId);
                await Promise.all([
                    loadInitialReceipts(currentChannelId, pluginGlobalStoreInstance.dispatch).catch(err => {
                        console.error('❌ [ReadReceiptPlugin] Failed to load receipts:', err);
                    }),
                    loadChannelReads(currentChannelId).catch(err => {
                        console.error('❌ [ReadReceiptPlugin] Failed to load channel reads:', err);
                    })
                ]);
                console.log('✅ [ReadReceiptPlugin] Pre-loaded receipts successfully');
            }

            // Register post component with error boundary
            try {
                if ((registry as any).registerPostTypeComponent) {
                    console.log('🧩 [ReadReceiptPlugin] Registering post component...');
                    (registry as any).registerPostTypeComponent(
                        (props: PostProps) => {
                            console.log('DEBUG: Store instance for registerPostTypeComponent Provider:', pluginGlobalStoreInstance);
                            if (!pluginGlobalStoreInstance) {
                                console.error("CRITICAL DEBUG: pluginGlobalStoreInstance is null/undefined for PostReceipt Provider!");
                            }
                            if (!props?.post?.id || props.post.type !== '') {
                                return null;
                            }
                            console.log('[ReadReceiptPlugin] Rendering for post:', props.post.id);
                            return (
                                <ErrorBoundary>
                                    <Provider store={pluginGlobalStoreInstance}>
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

            // Register wrapped root component
            registry.registerRootComponent(() => {
                console.log('DEBUG: Store instance for ReadReceiptRootObserver Provider:', pluginGlobalStoreInstance);
                if (!pluginGlobalStoreInstance) {
                    console.error("CRITICAL DEBUG: pluginGlobalStoreInstance is null/undefined for RootObserver Provider!");
                }
                return (
                    <ErrorBoundary>
                        <Provider store={pluginGlobalStoreInstance}>
                            <ReadReceiptRootObserver />
                        </Provider>
                    </ErrorBoundary>
                );
            });

            // Register WebSocket handler
            try {
                console.log('🔌 [ReadReceiptPlugin] Registering WebSocket handler...');
                // Register WebSocket event handler for read_receipt (should already exist)
                registry.registerWebSocketEventHandler(
                    'custom_mattermost-readreceipts_read_receipt',
                    handleWebSocketEvent(pluginGlobalStoreInstance.dispatch)
                );
                // Register per-post update WebSocket event handler
                registry.registerWebSocketEventHandler(
                    'custom_mattermost-readreceipts_post_read_receipt',
                    handleWebSocketEvent(pluginGlobalStoreInstance.dispatch)
                );
                // 1️⃣ Register handler for channel_readers events right after the existing one
                registry.registerWebSocketEventHandler(
                    'custom_mattermost-readreceipts_channel_readers',
                    handleWebSocketEvent(pluginGlobalStoreInstance.dispatch)
                );
                // 👇 add this **once**, right after the existing handler registrations
                registry.registerWebSocketEventHandler(
                    'custom_read_receipts_update', // ← event name sent by the server
                    handleWebSocketEvent(pluginGlobalStoreInstance.dispatch)
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
