import { createSlice, PayloadAction, createSelector } from '@reduxjs/toolkit';
import { RootState } from './types';

// State shape definition
export interface ChannelReadersState {
    [channelId: string]: {
        [postId: string]: string[] // array of userIds
    };
}

// Additional type for DM-specific actions
export interface AddReaderPayload {
    channelId: string;
    postId: string;
    userId: string;
    isDM?: boolean;
}

// Ensure initialState is an empty object
const initialState: ChannelReadersState = {};

// Memoized selector with debug logging
export const selectReaders = createSelector(
    [
        (state: RootState) => state.channelReaders,
        (_: RootState, channelId: string) => channelId,
        (_: RootState, _channelId: string, postId: string) => postId
    ],
    (channelReaders: ChannelReadersState, channelId: string, postId: string): string[] => {
        console.log('🔍 [Redux Selector] Selecting readers:', {
            channelId,
            postId,
            hasChannel: !!channelReaders[channelId],
            hasPost: channelReaders[channelId]?.[postId] !== undefined,
            readerCount: channelReaders[channelId]?.[postId]?.length || 0
        });
        return channelReaders?.[channelId]?.[postId] ?? [];
    }
);

// Slice definition
const channelReadersSlice = createSlice({
    name: 'channelReaders',
    initialState,
    reducers: {
        setReaders: (
            state: ChannelReadersState,
            action: PayloadAction<{
                channelId: string;
                payload: { [postId: string]: string[] };
            }>
        ) => {
            const { channelId, payload } = action.payload;
            
            if (!state[channelId]) {
                state[channelId] = {};
            }

            console.log('🔄 [Redux] Processing setReaders:', {
                channelId,
                payloadSize: Object.keys(payload).length
            });

            Object.entries(payload).forEach(([postId, userIds]) => {
                state[channelId][postId] = userIds;
            });
        },

        addReader: (
            state: ChannelReadersState,
            action: PayloadAction<AddReaderPayload>
        ) => {
            const { channelId, postId, userId, isDM } = action.payload;
            
            console.log('➕ [Redux] Processing addReader:', {
                channelId,
                postId,
                userId,
                isDM,
                beforeState: state[channelId]?.[postId]
            });

            if (!state[channelId]) {
                state[channelId] = {};
            }
            if (!state[channelId][postId]) {
                state[channelId][postId] = [];
            }

            // Split userId if it's a comma-separated string (legacy format)
            const userIds = userId.includes(',') ? userId.split(',') : [userId];

            // For DMs, merge the reader without duplicates
            if (isDM) {
                const existingReaders = new Set(state[channelId][postId]);
                userIds.forEach(id => existingReaders.add(id));
                state[channelId][postId] = Array.from(existingReaders);
            } else {
                // For regular channels, just add if not already present
                userIds.forEach(id => {
                    if (!state[channelId][postId].includes(id)) {
                        state[channelId][postId].push(id);
                    }
                });
            }

            console.log('✅ [Redux] Reader added:', {
                channelId,
                postId,
                readers: state[channelId][postId],
                isDM
            });
        },
    },
});

// Export actions
export const { setReaders, addReader } = channelReadersSlice.actions;

// Selectors
export const selectChannelSeenMap = (state: RootState, channelId: string) => {
    return state.channelReaders[channelId] || {};
};

// Legacy selector wrapper (maintains backward compatibility)
export const getMessageReadReceipts = (state: RootState, messageId: string): string[] => {
    // Assuming channel ID is encoded in message ID (channelId:postId format)
    const [channelId, postId] = messageId.split(':');
    return selectReaders(state, channelId, postId);
};

// Reducer
export default channelReadersSlice.reducer;
