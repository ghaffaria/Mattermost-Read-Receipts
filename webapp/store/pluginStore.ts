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

// Export the RootState and AppDispatch types from the store
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Initialize stores
let isStoreInitialized = false;
let initializationPromise: Promise<void> | null = null;

export const setMattermostStore = async (mattermostStore: Store<any>): Promise<void> => {
    if (!mattermostStore?.getState) {
        console.error('❌ [Store] Invalid Mattermost store provided');
        throw new Error('Invalid Mattermost store');
    }

    if (isStoreInitialized) {
        console.log('ℹ️ [Store] Store already initialized');
        return;
    }

    if (initializationPromise) {
        console.log('⏳ [Store] Waiting for existing initialization...');
        return initializationPromise;
    }

    initializationPromise = new Promise<void>((resolve, reject) => {
        try {
            // Validate Mattermost store has expected structure
            const state = mattermostStore.getState();
            if (!state?.entities?.users?.profiles) {
                throw new Error('Invalid Mattermost store structure');
            }

            // Set the store in legacy implementation
            setLegacyMattermostStore(mattermostStore);

            // Mark as initialized
            isStoreInitialized = true;

            // Log store initialization
            console.log('✅ [Store] Initialized stores:', {
                mattermost: true,
                plugin: true,
                profiles: Object.keys(state.entities.users.profiles).length
            });

            resolve();
        } catch (error) {
            console.error('❌ [Store] Failed to initialize store:', error);
            isStoreInitialized = false;
            initializationPromise = null;
            reject(error);
        }
    });

    return initializationPromise;
};
