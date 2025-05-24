// webapp/store.ts

import { configureStore, createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ReadReceiptState {
    receipts: Record<string, Set<string>>; // messageID → set of userIDs who have seen it
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
            if (!state.receipts) {
                state.receipts = {};
                console.log('🟠 [store] receipts state initialized');
            }
            if (!state.receipts[messageID]) {
                state.receipts[messageID] = new Set();
                console.log('🟠 [store] New messageID registered:', messageID);
            }
            if (!state.receipts[messageID].has(userID)) {
                state.receipts[messageID].add(userID);
                console.log('🟢 [store] upsertReceipt: user', userID, 'added to message', messageID);
                console.log('🟢 [store] State after upsert:', JSON.stringify([...state.receipts[messageID]]));
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
