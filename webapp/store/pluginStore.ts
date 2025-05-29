import { Store } from 'redux';
import { configureStore, EnhancedStore } from '@reduxjs/toolkit';
import { setMattermostStore as setLegacyMattermostStore } from './legacyStore';
import channelReadersReducer from './channelReaders';

// Store types
export interface StoreState {
    channelReaders: {
        [channelId: string]: {
            [messageId: string]: string[];
        };
    };
}

// Store configuration
const STORE_STATE_KEY = 'mattermost_readreceipts_state';
const STORE_INITIALIZED_KEY = 'mattermost_readreceipts_initialized';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// Development mode detection
const isDevelopment = window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1';

// Logger middleware for development
const logger = (store: any) => (next: any) => (action: any) => {
    if (isDevelopment) {
        console.log('🔄 [Redux] Dispatching:', { type: action.type, payload: action.payload });
    }
    const result = next(action);
    if (isDevelopment) {
        console.log('💾 [Redux] Next State:', store.getState());
    }
    return result;
};

// Load persisted state
const loadState = (): Partial<StoreState> | undefined => {
    try {
        const serializedState = localStorage.getItem(STORE_STATE_KEY);
        if (serializedState === null) {
            return undefined;
        }
        return JSON.parse(serializedState);
    } catch (err) {
        console.error('❌ [Store] Failed to load state:', err);
        return undefined;
    }
};

// Save state to persistent storage
const saveState = (state: StoreState) => {
    try {
        const serializedState = JSON.stringify(state);
        localStorage.setItem(STORE_STATE_KEY, serializedState);
        localStorage.setItem(STORE_INITIALIZED_KEY, 'true');
    } catch (err) {
        console.error('❌ [Store] Failed to save state:', err);
    }
};

// Store initialization state
let storeInstance: EnhancedStore | null = null;
let storeInitialized = false;

// Create store singleton with persistence
const createStore = (): EnhancedStore => {
    const persistedState = loadState();
    
    const store = configureStore({
        reducer: {
            channelReaders: channelReadersReducer,
        },
        preloadedState: persistedState || {
            channelReaders: {}, // Ensure this is not undefined
        },
        middleware: (getDefaultMiddleware) => getDefaultMiddleware({
            serializableCheck: isDevelopment,
            immutableCheck: isDevelopment,
            thunk: true,
        }).concat(logger),
        devTools: isDevelopment
    });

    // Subscribe to store changes for persistence
    store.subscribe(() => {
        if (storeInitialized) {
            const state = store.getState();
            saveState(state);
        }
    });

    return store;
};

// Get or create store instance
export const getStore = (): EnhancedStore => {
    if (!storeInstance) {
        storeInstance = createStore();
    }
    return storeInstance;
};

// Initialize the store singleton
export const store = getStore();
console.log('DEBUG: pluginStore.ts - Store created:', store);

// Helper to check store initialization
export const isStoreInitialized = () => {
    return storeInitialized && localStorage.getItem(STORE_INITIALIZED_KEY) === 'true';
};

// Set store initialization flag
export const markStoreInitialized = () => {
    storeInitialized = true;
    localStorage.setItem(STORE_INITIALIZED_KEY, 'true');
};

// Ensure store is ready for use
export const ensureStoreInitialized = () => {
    if (!isStoreInitialized()) {
        console.error('❌ [Store] Attempting to use store before initialization');
        throw new Error('Store not initialized');
    }
};

// Initialize stores with retry logic
let initializationPromise: Promise<void> | null = null;

export const setMattermostStore = async (mattermostStore: Store<any>): Promise<void> => {
    console.log('DEBUG: setMattermostStore called. Mattermost store valid:', !!(mattermostStore && mattermostStore.getState));
    if (initializationPromise) {
        return initializationPromise;
    }

    initializationPromise = new Promise(async (resolve, reject) => {
        let retryCount = 0;

        const initializeStore = async () => {
            try {
                if (!mattermostStore?.getState) {
                    throw new Error('Invalid Mattermost store');
                }

                // Initialize legacy store first
                await setLegacyMattermostStore(mattermostStore);

                // Get initial user profiles
                const state = mattermostStore.getState();
                const userProfiles = state?.entities?.users?.profiles || {};
                const profileCount = Object.keys(userProfiles).length;

                console.log('🔌 [Store] Initialized with Mattermost store:', {
                    hasStore: !!mattermostStore,
                    userProfiles: profileCount
                });

                // Mark store as initialized
                storeInitialized = true;
                console.log('DEBUG: storeInitialized set to true. Profiles count:', profileCount);
                localStorage.setItem(STORE_INITIALIZED_KEY, 'true');
                resolve();
            } catch (error) {
                console.error('DEBUG: Error in setMattermostStore, storeInitialized remains false:', error);
                storeInitialized = false; // Ensure it's false on error
                reject(error);
            }
        };

        await initializeStore();
    });

    return initializationPromise;
};

// Export a getter for plugin store for compatibility with ensureChannelReadsOnSwitch
export const getPluginStore = getStore;

// Type exports
export type RootState = StoreState;
export type AppDispatch = typeof store.dispatch;
