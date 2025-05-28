import { Store } from 'redux';
import { configureStore } from '@reduxjs/toolkit';
import { setMattermostStore as setLegacyMattermostStore } from './legacyStore';
import channelReadersReducer from './channelReaders';

// Determine if we're in development mode
const isDevelopment = window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1';

// Log Redux actions in development
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

// Create our Redux store with initial state
export const store = configureStore({
    reducer: {
        channelReaders: channelReadersReducer,
    },
    preloadedState: {
        channelReaders: {},
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({
        serializableCheck: isDevelopment,
        immutableCheck: isDevelopment,
        thunk: true,
    }).concat(logger),
    devTools: isDevelopment
});

// Store initialization status
let storeInitialized = false;

// Ensure store is initialized
export const ensureStoreInitialized = () => {
    if (!storeInitialized) {
        console.error('❌ [Store] Attempting to use store before initialization');
        throw new Error('Store not initialized');
    }
};

// Export the RootState and AppDispatch types from the store
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Initialize stores with retry logic
let initializationPromise: Promise<void> | null = null;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

export const setMattermostStore = async (mattermostStore: Store<any>): Promise<void> => {
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

                storeInitialized = true;
                resolve();
            } catch (error) {
                if (retryCount < MAX_RETRIES) {
                    retryCount++;
                    console.warn(`⚠️ [Store] Initialization failed, retrying (${retryCount}/${MAX_RETRIES})...`);
                    setTimeout(initializeStore, RETRY_DELAY);
                } else {
                    console.error('❌ [Store] Failed to initialize after retries:', error);
                    reject(error);
                }
            }
        };

        await initializeStore();
    });

    return initializationPromise;
};
