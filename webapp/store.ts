// webapp/store.ts

import { configureStore, createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ReadReceiptState {
    receipts: Record<string, string[]>; // messageID → array of userIDs who have seen it
}

const initialState: ReadReceiptState = {
    receipts: {},
};

const receiptSlice = createSlice({
    name: 'readReceipts',
    initialState,
    reducers: {
        upsertReceipt: (
            state,
            action: PayloadAction<{ messageID: string; userID: string }>
        ) => {
            const { messageID, userID } = action.payload;
            console.log('[Redux] upsertReceipt:', messageID, userID, 'Prev state:', state.receipts[messageID]);
            if (!state.receipts) {
                state.receipts = {};
                console.log('🟠 [store] receipts state initialized');
            }
            if (!state.receipts[messageID]) {
                state.receipts[messageID] = [];
                console.log('🟠 [store] New messageID registered:', messageID);
            }
            if (!state.receipts[messageID].includes(userID)) {
                state.receipts[messageID].push(userID);
                console.log('🟢 [store] upsertReceipt: user', userID, 'added to message', messageID);
                console.log('[Redux] State after upsert:', state.receipts[messageID]);
            } else {
                console.log(`ℹ️ [store] Receipt already exists: user ${userID} has already seen message ${messageID}`);
            }
        },
        // (اختیاری) در آینده resetReceipt
        // resetReceipts: (state) => { state.receipts = {}; },
    },
});

export const { upsertReceipt } = receiptSlice.actions;

export const store = configureStore({
    reducer: {
        readReceipts: receiptSlice.reducer,
    },
});

export type RootState = ReturnType<typeof store.getState>;
