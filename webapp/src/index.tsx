import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { store } from '../store';

const Root = () => (
    <Provider store={store}>
        <div>App Content</div>
    </Provider>
);

// Mattermost injects a root div for the plugin; just ensure we export something.
export default Root;
