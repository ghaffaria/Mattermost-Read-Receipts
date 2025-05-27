import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from './types';

// State shape definition
export interface ChannelReadersState {
    [channelId: string]: {
        [postId: string]: string[] // array of userIds
    };
}

// Ensure initialState is an empty object
const initialState: ChannelReadersState = {};

// Selector helper to get readers for a specific post
export const makeSelectReaders = (channelId: string, postId: string) =>
    (state: RootState): string[] =>
        state.channelReaders[channelId]?.[postId] ?? [];

// Selector helper to get readers for a specific post
export const selectReaders = (channelId: string, postId: string) =>
    (state: RootState): string[] =>
        state.channelReaders?.[channelId]?.[postId] ?? [];

// Slice definition
const channelReadersSlice = createSlice({
    name: 'channelReaders',
    initialState,
    reducers: {
        setReaders: (
            state,
            action: PayloadAction<{
                channelId: string;
                payload: { [postId: string]: string[] };
            }>
        ) => {
            const { channelId, payload } = action.payload;
            if (!state[channelId]) {
                state[channelId] = {};
            }
            state[channelId] = payload;
        },
        addReader: (
            state,
            action: PayloadAction<{
                channelId: string;
                postId: string;
                userId: string;
            }>
        ) => {
            const { channelId, postId, userId } = action.payload;
            if (!state[channelId]) {
                state[channelId] = {};
            }
            if (!state[channelId][postId]) {
                state[channelId][postId] = [];
            }
            if (!state[channelId][postId].includes(userId)) {
                state[channelId][postId].push(userId);
            }
        },
    },
});

// Action creators
export const { setReaders, addReader } = channelReadersSlice.actions;

// Selectors
export const selectChannelSeenMap = (state: RootState, channelId: string) => {
    return state.channelReaders[channelId] || {};
};

// Legacy selector wrapper (maintains backward compatibility)
export const getMessageReadReceipts = (state: RootState, messageId: string): string[] => {
    // Assuming channel ID is encoded in message ID (channelId:postId format)
    const [channelId, postId] = messageId.split(':');
    return makeSelectReaders(channelId, postId)(state);
};

// Reducer
export default channelReadersSlice.reducer;
