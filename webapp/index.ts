import {PluginRegistry} from 'mattermost-webapp/plugins/registry';
import {Store, combineReducers, Reducer, AnyAction} from 'redux';
import {createSlice, PayloadAction} from '@reduxjs/toolkit';

// Define the initial state for the read-receipt slice.
interface ReadReceiptState {
    seenBy: Record<string, string[]>; // Maps message IDs to arrays of user IDs who have seen the message.
}

const initialState: ReadReceiptState = {
    seenBy: {},
};

// Create a Redux slice for managing read-receipt state.
const readReceiptSlice = createSlice({
    name: 'readReceipt',
    initialState,
    reducers: {
        addReadReceipt: (state: { seenBy: Record<string, string[]> }, action: PayloadAction<{ messageID: string; userID: string }>) => {
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

export const {addReadReceipt} = readReceiptSlice.actions;

// Register the plugin and integrate the Redux slice.
export default class ReadReceiptPlugin {
    initialize(registry: PluginRegistry, store: Store) {
        // Add the read-receipt reducer to the Redux store.
        const rootReducer = combineReducers({
            ...store.getState(),
            readReceipt: readReceiptSlice.reducer,
        });
        store.replaceReducer(rootReducer as Reducer<any, AnyAction>);

        console.log('ReadReceiptPlugin initialized');
    }
}
