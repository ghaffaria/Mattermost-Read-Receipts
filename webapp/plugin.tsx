import React from 'react';
import {PluginRegistry} from 'mattermost-webapp/plugins/registry';
import PostReceipt from './components/PostReceipt';

export default class ReadReceiptPlugin {
    initialize(registry: PluginRegistry) {
        // Register PostReceipt to render after the message body.
        registry.registerPostTypeComponent('custom_read_receipt', (props: { post: { id: string }; children?: React.ReactNode }) => {
            const { post, children } = props;
            return (
                <>
                    {children}
                    <PostReceipt messageId={post.id} />
                </>
            );
        });

        console.log('ReadReceiptPlugin initialized and PostReceipt registered.');
    }
}
