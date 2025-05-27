import { createAsyncThunk } from '@reduxjs/toolkit';
import { setReaders } from '../store/channelReaders';

interface ChannelReadersResponse {
    [postId: string]: string[]; // Map of post IDs to arrays of user IDs
}

/**
 * Loads read receipts for messages in a channel.
 * @param channelId - The ID of the channel to load readers for
 * @param sincePostId - Optional post ID to load readers since (for pagination/incremental loading)
 */
export const loadChannelReaders = createAsyncThunk(
    'channelReaders/loadChannelReaders',
    async (params: { channelId: string; sincePostId?: string }, { dispatch }) => {
        const { channelId, sincePostId } = params;
        let url = `/plugins/mattermost-readreceipts/api/v1/read/channel/${channelId}`;
        
        if (sincePostId) {
            url += `?since_post=${sincePostId}`;
        }

        console.log('📥 [Channel Actions] Loading readers:', {
            channelId,
            sincePostId,
            url
        });

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'same-origin',
            });

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}`);
            }

            const readers: ChannelReadersResponse = await response.json();
            
            console.log('✅ [Channel Actions] Loaded readers:', {
                channelId,
                postCount: Object.keys(readers).length,
                readers
            });

            // Update Redux store with the loaded readers
            dispatch(setReaders({
                channelId,
                payload: readers
            }));

            return readers;
        } catch (error) {
            console.error('❌ [Channel Actions] Failed to load readers:', {
                channelId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
);
