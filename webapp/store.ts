
// webapp/store.ts

import { configureStore, createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ReadReceiptState {
    receipts: Record<string, string[]>; // messageID → list of userIDs who have seen it
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
            if (!state.receipts[messageID]) {
                state.receipts[messageID] = [];
            }
            if (!state.receipts[messageID].includes(userID)) {
                state.receipts[messageID].push(userID);
            }
        },
    },
});

export const { upsertReceipt } = receiptSlice.actions;

export const store = configureStore({
    reducer: {
        readReceipts: receiptSlice.reducer,
    },
});

export type RootState = ReturnType<typeof store.getState>;
