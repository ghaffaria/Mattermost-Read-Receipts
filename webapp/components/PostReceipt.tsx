
// webapp/components/PostReceipt.tsx
// webapp/components/PostReceipt.tsx

import React, { FC, ReactElement } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import VisibilityTracker from './VisibilityTracker';

interface Post {
    id: string;
}

interface PostReceiptProps {
    post: Post;
}

const PostReceipt: FC<PostReceiptProps> = ({ post }): ReactElement => {
    const messageId = post.id;
    const seenBy = useSelector((state: RootState) => state.readReceipts.receipts[messageId] || []);

    console.log('📦 PostReceipt mounted for:', messageId);
    console.log('👁 seenBy:', seenBy);

    return (
        <div style={{ border: '1px dashed #ccc', padding: '2px', marginTop: '4px' }}>
            👁️ ReadReceipt zone for {messageId}
            <VisibilityTracker messageId={messageId} />

            {seenBy.length > 0 && (
                <div className="post-receipt">
                    <span className="eye-icon">👁</span>
                    <div className="tooltip">
                        Seen by: {seenBy.join(', ')}
                    </div>
                </div>
            )}
        </div>
    );
};


export default PostReceipt;
