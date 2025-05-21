
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
        <>
            <VisibilityTracker messageId={messageId} />

            {seenBy.length > 0 && (
                <div className="post-receipt">
                    <span className="eye-icon">👁</span>
                    <div className="tooltip">
                        Seen by: {seenBy.join(', ')}
                    </div>

                    <style>{`
                        .post-receipt {
                            position: relative;
                            display: inline-block;
                            margin-left: 8px;
                        }

                        .eye-icon {
                            color: #666;
                            cursor: pointer;
                        }

                        .tooltip {
                            visibility: hidden;
                            background-color: #555;
                            color: #fff;
                            text-align: center;
                            border-radius: 5px;
                            padding: 5px;
                            position: absolute;
                            z-index: 1;
                            bottom: 125%;
                            left: 50%;
                            transform: translateX(-50%);
                            opacity: 0;
                            transition: opacity 0.3s;
                        }

                        .post-receipt:hover .tooltip {
                            visibility: visible;
                            opacity: 1;
                        }
                    `}</style>
                </div>
            )}
        </>
    );
};

export default PostReceipt;
