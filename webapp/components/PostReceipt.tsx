// webapp/components/PostReceipt.tsx
console.log("🔥 mattermost-readreceipts webapp bundle loaded. PostReceipt.tsx!");

import React, { FC, ReactElement, useEffect } from 'react';
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
    console.log('🏷️ [PostReceipt] props.post =', post);

    // محافظت اگر پست نال یا بی‌اید بود
    if (!post) {
        console.warn('🚫 [PostReceipt] Called with null/undefined post object:', post);
        return null;
    }
    if (!post.id) {
        console.warn('🚫 [PostReceipt] Called with post missing id:', post);
        return null;
    }

    const messageId = post.id;

    // وقتی این کامپوننت هر بار mount می‌شود لاگ می‌گیریم
    useEffect(() => {
        console.log(`🌀 [PostReceipt] useEffect - Mounted for messageId=${messageId}`);
        return () => {
            console.log(`🧹 [PostReceipt] useEffect - Unmounting for messageId=${messageId}`);
        };
    }, [messageId]);

    // گرفتن کاربران دیده‌شده
    const seenBy = useSelector((state: RootState) => {
        const arr = (state.readReceipts && state.readReceipts.receipts && state.readReceipts.receipts[messageId]) || [];
        console.log('🔎 [PostReceipt] useSelector seenBy for', messageId, '=', arr);
        return arr;
    });

    // لاگ نهایی قبل از رندر
    console.log(`📦 [PostReceipt] About to render for messageId=${messageId} | seenBy=`, seenBy);

    return (
        <div style={{ border: '1px dashed #ccc', padding: '2px', marginTop: '4px' }}>
            <span>👁️ ReadReceipt zone for <b>{messageId}</b></span>
            <VisibilityTracker messageId={messageId} />

            {Array.isArray(seenBy) && seenBy.length > 0 && (
                <div className="post-receipt">
                    <span className="eye-icon">👁</span>
                    <div className="tooltip">
                        Seen by: {seenBy.join(', ')}
                    </div>
                </div>
            )}
            {(!Array.isArray(seenBy) || seenBy.length === 0) && (
                <div style={{ fontSize: '12px', color: '#bbb' }}>Nobody has seen this yet.</div>
            )}
        </div>
    );
};

export default PostReceipt;
