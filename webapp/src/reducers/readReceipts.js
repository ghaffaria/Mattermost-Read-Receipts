const initialState = { 
    postReadReceipts: {}, 
    channelReaders: {} 
};

export default function readReceiptsReducer(state = initialState, action) {
    switch (action.type) {
        case 'RECEIPT_RECEIVED': {
            const { post_id, user_id } = action.data;
            const prevReaders = state.postReadReceipts[post_id] || [];
            
            // Don't add duplicate readers
            if (prevReaders.includes(user_id)) {
                return state;
            }
            
            return {
                ...state,
                postReadReceipts: {
                    ...state.postReadReceipts,
                    [post_id]: [...prevReaders, user_id]
                }
            };
        }
        
        case 'CHANNEL_READERS_UPDATED': {
            const { channel_id, readers } = action.data;
            return {
                ...state,
                channelReaders: {
                    ...state.channelReaders,
                    [channel_id]: readers
                }
            };
        }
        
        case 'LOAD_RECEIPTS_SUCCESS': {
            const { receipts } = action.data;
            const postReadReceipts = {};
            
            receipts.forEach(receipt => {
                if (!postReadReceipts[receipt.message_id]) {
                    postReadReceipts[receipt.message_id] = [];
                }
                if (!postReadReceipts[receipt.message_id].includes(receipt.user_id)) {
                    postReadReceipts[receipt.message_id].push(receipt.user_id);
                }
            });
            
            return {
                ...state,
                postReadReceipts: {
                    ...state.postReadReceipts,
                    ...postReadReceipts
                }
            };
        }
        
        case 'CLEAR_CHANNEL_RECEIPTS': {
            const { channel_id } = action.data;
            const newPostReadReceipts = { ...state.postReadReceipts };
            
            // Remove receipts for posts in this channel
            Object.keys(newPostReadReceipts).forEach(postId => {
                // Note: We'd need channel info to properly filter by channel
                // For now, this is a placeholder for channel-specific clearing
            });
            
            return {
                ...state,
                channelReaders: {
                    ...state.channelReaders,
                    [channel_id]: {}
                }
            };
        }
        
        default:
            return state;
    }
}
