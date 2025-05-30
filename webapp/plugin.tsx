// webapp/plugin.tsx
import React from 'react';
// @ts-ignore
import {PluginRegistry} from 'mattermost-webapp/plugins/registry';
import PostReceipt from './components/PostReceipt';
import {handleWebSocketEvent, initializeDirectWebSocketInterception} from './websocket';
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
        
        // Initialize safe WebSocket interception AFTER Mattermost initializes
        setTimeout(() => {
            try {
                console.log('🔧 [ReadReceiptPlugin] Initializing safe WebSocket interception...');
                initializeDirectWebSocketInterception();
                console.log('✅ [ReadReceiptPlugin] Safe WebSocket interception initialized');
            } catch (error) {
                console.error('❌ [ReadReceiptPlugin] Failed to initialize WebSocket interception:', error);
            }
        }, 2000); // Wait 2 seconds for Mattermost to fully initialize
        
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
                console.log('📥 [ReadReceiptPlugin] Pre-loading receipts for channel (initial load):', currentChannelId);
                await Promise.all([
                    loadInitialReceipts(currentChannelId, pluginGlobalStoreInstance.dispatch, true).catch(err => {
                        console.error('❌ [ReadReceiptPlugin] Failed to load receipts:', err);
                    }),
                    loadChannelReads(currentChannelId, true).catch(err => {
                        console.error('❌ [ReadReceiptPlugin] Failed to load channel reads:', err);
                    })
                ]);
                console.log('✅ [ReadReceiptPlugin] Pre-loaded receipts successfully (no UI updates triggered)');
            }

            // Debug: Hook into Mattermost's WebSocket system directly
            try {
                console.log('🔌 [ReadReceiptPlugin] Setting up direct WebSocket debugging...');
                
                // Try to access Mattermost's WebSocket client directly
                const mmStore = mattermostStore.getState();
                if (mmStore?.websocket) {
                    console.log('🌐 [ReadReceiptPlugin] Found Mattermost WebSocket in store:', mmStore.websocket);
                }
                
                // Hook into window.mm if available
                if (typeof window !== 'undefined' && (window as any).mm) {
                    console.log('🌐 [ReadReceiptPlugin] Found window.mm:', (window as any).mm);
                    
                    // Try to access WebSocket client
                    const mmClient = (window as any).mm.Client4 || (window as any).mm.client;
                    if (mmClient) {
                        console.log('🌐 [ReadReceiptPlugin] Found MM client:', mmClient);
                    }
                }
                
                // Try accessing the WebSocket client through global variables
                if (typeof window !== 'undefined') {
                    const globals = ['Client4', 'mmClient', 'WebSocketClient'];
                    globals.forEach(globalName => {
                        if ((window as any)[globalName]) {
                            console.log(`🌐 [ReadReceiptPlugin] Found global ${globalName}:`, (window as any)[globalName]);
                        }
                    });
                }
                
            } catch (error) {
                console.error('❌ [ReadReceiptPlugin] Error in WebSocket debugging setup:', error);
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

            // Register WebSocket handlers
            try {
                console.log('🔌 [ReadReceiptPlugin] Registering WebSocket handlers...');
                
                const wsHandler = handleWebSocketEvent(pluginGlobalStoreInstance.dispatch);
                
                // Create a debug handler to catch ALL WebSocket events
                const debugHandler = (event: any) => {
                    console.log('🌐 [ReadReceiptPlugin] Registry WebSocket event received:', {
                        eventType: event?.event || 'unknown',
                        hasData: !!event?.data,
                        fullEvent: event,
                        timestamp: new Date().toISOString()
                    });
                    
                    // Call the original handler too
                    return wsHandler(event);
                };
                
                // Test: Register a catch-all handler to see if ANY WebSocket events are received
                if (typeof (registry as any).registerWebSocketEventHandler === 'function') {
                    console.log('✅ [ReadReceiptPlugin] WebSocket registration function exists');
                    
                    // Register catch-all handlers for common events to test
                    const testEvents = [
                        'user_typing',
                        'posted',
                        'post_updated',
                        'channel_viewed',
                        'preference_changed'
                    ];
                    
                    testEvents.forEach(eventType => {
                        try {
                            (registry as any).registerWebSocketEventHandler(eventType, (event: any) => {
                                console.log(`🔬 [ReadReceiptPlugin] TEST: Received ${eventType} event:`, event);
                            });
                            console.log(`✅ [ReadReceiptPlugin] Registered test handler for ${eventType}`);
                        } catch (error) {
                            console.warn(`⚠️ [ReadReceiptPlugin] Failed to register test handler for ${eventType}:`, error);
                        }
                    });
                    
                    // Register handler for read receipt events
                    (registry as any).registerWebSocketEventHandler(
                        'custom_mattermost-readreceipts_read_receipt',
                        debugHandler
                    );
                    console.log('✅ [ReadReceiptPlugin] Registered read receipt handler');
                    
                    // Register handler for channel readers events
                    (registry as any).registerWebSocketEventHandler(
                        'custom_mattermost-readreceipts_channel_readers',
                        debugHandler
                    );
                    console.log('✅ [ReadReceiptPlugin] Registered channel readers handler');
                    
                    // Test: Register a catch-all handler for debugging
                    if (typeof window !== 'undefined' && window.WebSocket) {
                        console.log('🌐 [ReadReceiptPlugin] Setting up global WebSocket debugging...');
                        const originalSend = WebSocket.prototype.send;
                        WebSocket.prototype.send = function(data) {
                            console.log('🌐 [WebSocket] Outgoing:', data);
                            return originalSend.call(this, data);
                        };
                    }
                } else {
                    console.error('❌ [ReadReceiptPlugin] registerWebSocketEventHandler function not found on registry');
                    console.log('🔍 [ReadReceiptPlugin] Available registry methods:', Object.keys(registry));
                }
                
                console.log('✅ [ReadReceiptPlugin] WebSocket handlers registered');
            } catch (error) {
                console.error('❌ [ReadReceiptPlugin] Failed to register WebSocket handlers:', error);
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
