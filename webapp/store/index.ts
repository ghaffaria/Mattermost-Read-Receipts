import { configureStore, combineReducers } from '@reduxjs/toolkit';
import channelReadersReducer from './channelReaders';
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
