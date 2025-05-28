import { configureStore, combineReducers } from '@reduxjs/toolkit';
import channelReadersReducer from './channelReaders';
import { loadChannelReads } from '../store';
import type { RootState } from './types';

// Combine our reducers
const rootReducer = combineReducers({
    channelReaders: channelReadersReducer,
    // Add other reducers here as needed
});

// Create the store
const reduxStore = configureStore({
    reducer: rootReducer,
});

// Export types
export type { RootState };
export type AppDispatch = typeof reduxStore.dispatch;

// Export the store instance as 'store'
export { reduxStore as store };

// Re-export channelReaders actions and selectors
export * from './channelReaders';

// Re-export legacy store functionality
export * from './legacyStore';

// Utility: Ensure channel reads are loaded on channel switch
export const ensureChannelReadsOnSwitch = (store: any) => {
    store.subscribe(() => {
        const chan = store.getState().entities.channels.currentChannelId;
        if (chan && chan !== (window as any).__lastCRChan) {
            store.dispatch(loadChannelReads(chan));
            (window as any).__lastCRChan = chan;
        }
    });
};
