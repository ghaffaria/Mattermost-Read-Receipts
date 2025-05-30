import { configureStore, combineReducers } from '@reduxjs/toolkit';
import channelReadersReducer from './channelReaders';
import { loadChannelReads } from '../store'; // fallback to original, since not exported from channelReaders
import type { RootState } from './types';
import { getPluginStore } from './pluginStore'; // use getPluginStore, but alias to getStore for code compatibility

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
export type AppDispatch = any;

// Re-export channelReaders actions and selectors
export * from './channelReaders';

// Re-export legacy store functionality
export * from './legacyStore';

// Utility: Ensure channel reads are loaded on channel switch
export const ensureChannelReadsOnSwitch = (mmStore: any) => {
    if ((window as any).__ensuredCRSwitch) {
        return; // already wired
    }
    (window as any).__ensuredCRSwitch = true;

    mmStore.subscribe(() => {
        const chan = mmStore.getState().entities.channels.currentChannelId;
        if (chan && chan !== (window as any).__lastCRChan) {
            const pluginStore = getPluginStore();
            if (pluginStore) {
                // ✅ Channel switching should NOT trigger "Seen by" UI updates (isInitialLoad: true)
                loadChannelReads(chan, true);
            }
            (window as any).__lastCRChan = chan;
        }
    });
};
