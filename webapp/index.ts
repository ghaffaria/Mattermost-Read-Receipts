import { PluginRegistry } from 'mattermost-webapp/plugins/registry';
import { Store } from 'redux';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// Define the initial state
interface ReadReceiptState {
    seenBy: Record<string, string[]>;
}

const initialState: ReadReceiptState = {
    seenBy: {},
};

// Redux slice
const readReceiptSlice = createSlice({
    name: 'readReceipt',
    initialState,
    reducers: {
        addReadReceipt: (
            state,
            action: PayloadAction<{ messageID: string; userID: string }>
        ) => {
            const { messageID, userID } = action.payload;
            if (!state.seenBy[messageID]) {
                state.seenBy[messageID] = [];
            }
            if (!state.seenBy[messageID].includes(userID)) {
                state.seenBy[messageID].push(userID);
            }
        },
    },
});

export const { addReadReceipt } = readReceiptSlice.actions;

export default class ReadReceiptPlugin {
    initialize(registry: PluginRegistry, store: Store) {
        // اضافه کردن reducer فقط برای بخش پلاگین
        if ('registerReducer' in store) {
            (store as any).registerReducer('readReceipt', readReceiptSlice.reducer);
            console.log('✅ readReceipt reducer registered using store.registerReducer');
        } else {
            console.warn('⚠️ store.registerReducer not available — falling back (not recommended)');
        }

        console.log('ReadReceiptPlugin initialized');
    }
}
