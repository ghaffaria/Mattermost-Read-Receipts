// webapp/components/PostReceipt.tsx
import React, { FC, ReactElement, useEffect, useState } from 'react';
import { getMessageReadReceipts, getUserDisplayName } from '../store';
import VisibilityTracker from './VisibilityTracker';

interface Post {
    id: string;
}

interface PostReceiptProps {
    post: Post;
}

interface WebSocketEventData {
    event: string;
    data: {
        message_id: string;
        user_id: string;
    };
}

const PostReceipt: FC<PostReceiptProps> = ({ post }): ReactElement | null => {
    console.log('🔄 [PostReceipt] Rendering:', {
        postId: post?.id,
        hasPost: !!post,
        timestamp: new Date().toISOString()
    });

    if (!post?.id) {
        console.warn('⚠️ [PostReceipt] Invalid post:', post);
        return null;
    }

    const messageId = post.id;
    const [seenBy, setSeenBy] = useState<string[]>([]);
    const currentUserId = document.cookie.match(/MMUSERID=([^;]+)/)?.[1] || 
                         window.localStorage.getItem('MMUSERID') || '';

    // Update local state from our store
    useEffect(() => {
        const receipts = getMessageReadReceipts(messageId);
        console.log('📥 [PostReceipt] Loading receipts:', {
            messageId,
            receipts,
            currentUserId,
            timestamp: new Date().toISOString()
        });
        setSeenBy(receipts);
    }, [messageId]);

    // Handle WebSocket events
    useEffect(() => {
        const handleWebSocketEvent = (event: Event) => {
            const customEvent = event as CustomEvent<WebSocketEventData>;
            if (customEvent.detail.event === 'custom_mattermost-readreceipts_read_receipt') {
                const { message_id, user_id } = customEvent.detail.data;
                if (message_id === messageId) {
                    console.log('👁️ [PostReceipt] Receipt event:', {
                        messageId: message_id,
                        userId: user_id,
                        username: getUserDisplayName(user_id),
                        timestamp: new Date().toISOString()
                    });

                    setSeenBy(prev => !prev.includes(user_id) ? [...prev, user_id] : prev);
                }
            }
        };

        console.log('👂 [PostReceipt] Adding WebSocket listener:', {
            messageId,
            timestamp: new Date().toISOString()
        });
        
        window.addEventListener('mattermost-websocket-event', handleWebSocketEvent as EventListener);
        
        return () => {
            console.log('🗑️ [PostReceipt] Removing WebSocket listener:', {
                messageId,
                timestamp: new Date().toISOString()
            });
            window.removeEventListener('mattermost-websocket-event', handleWebSocketEvent as EventListener);
        };
    }, [messageId]);

    const seenByOthers = seenBy.filter(id => id !== currentUserId);
    const seenByOthersDisplay = seenByOthers.map(userId => getUserDisplayName(userId));

    console.log('👀 [PostReceipt] Preparing display:', {
        messageId,
        seenByOthers,
        seenByOthersDisplay,
        currentUserId,
        timestamp: new Date().toISOString()
    });

    // Return tracker and content together
    return (
        <div 
            className="post-receipt-container" 
            data-post-id={messageId}
            data-component="post-receipt"
        >
            <VisibilityTracker messageId={messageId} key={`tracker-${messageId}`} />
            {seenByOthers.length > 0 && (
                <div 
                    className="post-receipt" 
                    style={{ 
                        fontSize: '12px', 
                        color: '#666',
                        padding: '4px',
                        marginTop: '4px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                    }}
                    data-seen-by={seenByOthers.join(',')}
                >
                    <span className="eye-icon" role="img" aria-label="Seen by">👁</span>
                    <div className="tooltip" style={{
                        display: 'inline-block'
                    }}>
                        Seen by: {seenByOthersDisplay.join(', ')}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PostReceipt;