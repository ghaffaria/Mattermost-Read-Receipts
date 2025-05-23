// webapp/components/PostReceipt.tsx
console.log("🔥 mattermost-readreceipts webapp bundle loaded. PostReceipt.tsx!");

import React, { FC, ReactElement, useEffect, useState } from 'react';
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
    const [seenBy, setSeenBy] = useState<string[]>([]);

    // وقتی این کامپوننت هر بار mount می‌شود لاگ می‌گیریم
    useEffect(() => {
        console.log(`🌀 [PostReceipt] useEffect - Mounted for messageId=${messageId}`);
        return () => {
            console.log(`🧹 [PostReceipt] useEffect - Unmounting for messageId=${messageId}`);
        };
    }, [messageId]);

    useEffect(() => {
        const fetchReceipts = async () => {
            try {
                console.log(`🔄 Fetching receipts for messageId=${post.id}`);
                const response = await fetch(`/plugins/mattermost-readreceipts/api/v1/receipts?message_id=${post.id}`);
                if (response.ok) {
                    const data = await response.json();
                    console.log(`✅ Receipts fetched for messageId=${post.id}:`, data);
                    setSeenBy(data.seen_by || []);
                } else {
                    console.error(`❌ Failed to fetch receipts for messageId=${post.id}:`, response.status);
                }
            } catch (error) {
                console.error(`❌ Error fetching receipts for messageId=${post.id}:`, error);
            }
        };

        fetchReceipts();
    }, [post.id]);

    // لاگ نهایی قبل از رندر
    console.log(`📦 [PostReceipt] About to render for messageId=${messageId} | seenBy=`, seenBy);

    return (
        <div style={{ border: '1px dashed #ccc', padding: '2px', marginTop: '4px' }}>
            <span>👁️ ReadReceipt zone for <b>{messageId}</b></span>
            <VisibilityTracker messageId={messageId} />

            {seenBy.length > 0 ? (
                <div className="post-receipt">
                    <span className="eye-icon">👁</span>
                    <div className="tooltip">
                        Seen by: {seenBy.join(', ')}
                    </div>
                </div>
            ) : (
                <div style={{ fontSize: '12px', color: '#bbb' }}>Nobody has seen this yet.</div>
            )}
        </div>
    );
};

export default PostReceipt;
