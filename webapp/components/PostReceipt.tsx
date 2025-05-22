// webapp/components/PostReceipt.tsx
console.log("🔥 mattermost-readreceipts webapp bundle loaded. PostReceipt.tsx!");

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

const PostReceipt: FC<PostReceiptProps> = ({ post }): ReactElement | null => {
    console.log('🏷️ [PostReceipt] props.post=', post);
    // محافظت اگر پست نال یا بی‌اید بود
    if (!post || !post.id) {
        console.warn('🚫 [PostReceipt] Called with invalid post object:', post);
        return null;
    }

    const messageId = post.id;
    // باگ بالقوه: ممکن است state یا receipts خالی باشد (در bootstrap اول پلاگین)
    const seenBy = useSelector((state: RootState) =>
        (state.readReceipts && state.readReceipts.receipts && state.readReceipts.receipts[messageId]) || []
    );

    console.log(`📦 [PostReceipt] Mounted for messageId=${messageId}`, post);
    console.log('👁 [PostReceipt] seenBy:', seenBy);

    return (
        <div style={{ border: '1px dashed #ccc', padding: '2px', marginTop: '4px' }}>
            <span>👁️ ReadReceipt zone for <b>{messageId}</b></span>
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
