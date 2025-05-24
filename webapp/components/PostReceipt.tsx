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
    console.log('[PostReceipt] render, post.id:', post?.id, 'post:', post);

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

    const seenByFromRedux = useSelector((state: RootState) => state.readReceipts.receipts[messageId] || []);

    // Get current user ID from Mattermost global window or localStorage
    const currentUserId = window.localStorage.getItem('MMUSERID') || (window as any).currentUserId || '';

    useEffect(() => {
        console.log(`🔍 [PostReceipt] Redux state for messageId=${messageId}:`, seenByFromRedux, '| currentUserId:', currentUserId);
        console.log('[PostReceipt] seenByFromRedux:', seenByFromRedux);
        setSeenBy(Array.from(seenByFromRedux));
    }, [seenByFromRedux]);

    // وقتی این کامپوننت هر بار mount می‌شود لاگ می‌گیریم
    useEffect(() => {
        console.log(`🌀 [PostReceipt] useEffect - Mounted for messageId=${messageId}`);
        console.log('[PostReceipt] Mounted for messageId=', messageId);
        return () => {
            console.log(`🧹 [PostReceipt] useEffect - Unmounting for messageId=${messageId}`);
            console.log('[PostReceipt] Unmount for messageId=', messageId);
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

    useEffect(() => {
        const handleWebSocketEvent = (event: Event) => {
            const customEvent = event as CustomEvent<{ event: string; data: { message_id: string; user_id: string } }>;
            if (customEvent.detail.event === 'custom_mattermost-readreceipts_read_receipt') {
                const { message_id, user_id } = customEvent.detail.data;
                if (message_id === post.id) {
                    setSeenBy((prevSeenBy) => {
                        if (!prevSeenBy.includes(user_id)) {
                            return [...prevSeenBy, user_id];
                        }
                        return prevSeenBy;
                    });
                }
            }
        };

        window.addEventListener('mattermost-websocket-event', handleWebSocketEvent as EventListener);

        return () => {
            window.removeEventListener('mattermost-websocket-event', handleWebSocketEvent as EventListener);
        };
    }, [post.id]);

    // لاگ نهایی قبل از رندر
    console.log(`📦 [PostReceipt] About to render for messageId=${messageId} | currentUserId=${currentUserId} | seenBy=`, seenBy);
    console.log('[PostReceipt] seenBy for messageId=', messageId, 'is', seenBy);
    if (seenBy.length > 0) {
        console.log('[PostReceipt] Seen by:', seenBy);
    } else {
        console.log('[PostReceipt] No one has seen this yet');
    }

    return (
        <div style={{ border: '1px dashed #ccc', padding: '2px', marginTop: '4px' }}>
            <span>👁️ ReadReceipt zone for <b>{messageId}</b> | currentUserId: <b>{currentUserId}</b></span>
            <VisibilityTracker messageId={messageId} />

            {seenBy.length > 0 ? (
                <div className="post-receipt">
                    <span className="eye-icon">👁</span>
                    <div className="tooltip">
                        Seen by: {seenBy.map((user) => <span key={user}>{user}</span>)}
                    </div>
                </div>
            ) : (
                <div style={{ fontSize: '12px', color: '#bbb' }}>Nobody has seen this yet.</div>
            )}
        </div>
    );
};

export default PostReceipt;
