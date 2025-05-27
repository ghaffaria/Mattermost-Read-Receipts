import { configureStore } from '@reduxjs/toolkit';
import channelReadersReducer, { selectReaders, addReader, setReaders } from './channelReaders';
import type { RootState } from './types';

// Create a test store with the channelReaders reducer
const store = configureStore({
    reducer: {
        channelReaders: channelReadersReducer,
    },
});

// Helper function to get the state
const getState = (): RootState => store.getState() as RootState;

describe('channelReaders slice', () => {
    beforeEach(() => {
        // Reset the store state before each test
        store.dispatch(setReaders({ channelId: 'test-channel', payload: {} }));
    });

    test('selectReaders should return an empty array if no readers exist', () => {
        const readers = selectReaders('non-existent-channel', 'non-existent-post')(getState());
        expect(readers).toEqual([]);
    });

    test('addReader should add a reader to the state', () => {
        store.dispatch(addReader({ channelId: 'test-channel', postId: 'test-post', userId: 'user1' }));
        const readers = selectReaders('test-channel', 'test-post')(getState());
        expect(readers).toEqual(['user1']);
    });

    test('addReader should not add duplicate readers', () => {
        store.dispatch(addReader({ channelId: 'test-channel', postId: 'test-post', userId: 'user1' }));
        store.dispatch(addReader({ channelId: 'test-channel', postId: 'test-post', userId: 'user1' }));
        const readers = selectReaders('test-channel', 'test-post')(getState());
        expect(readers).toEqual(['user1']);
    });

    test('setReaders should overwrite existing readers', () => {
        store.dispatch(addReader({ channelId: 'test-channel', postId: 'test-post', userId: 'user1' }));
        store.dispatch(setReaders({ channelId: 'test-channel', payload: { 'test-post': ['user2'] } }));
        const readers = selectReaders('test-channel', 'test-post')(getState());
        expect(readers).toEqual(['user2']);
    });
});
