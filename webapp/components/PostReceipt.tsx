// webapp/components/PostReceipt.tsx
import React, { FC, ReactElement, useEffect, useState } from 'react';
import { getMessageReadReceipts, getUserDisplayName, RECEIPT_STORE_UPDATE } from '../store';
import VisibilityTracker from './VisibilityTracker';
import { Post } from '../types/mattermost-webapp';

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

interface StoreReceipt {
    messageId: string;
    users: string[];
}

interface StoreUpdateEvent extends CustomEvent {
    detail: {
        type: string;
        receipts?: StoreReceipt[];
    };
}

const PostReceipt: FC<PostReceiptProps> = ({ post }): ReactElement | null => {
    console.log('🔄 [PostReceipt] Rendering:', {
        postId: post?.id,
        hasPost: !!post,
        channelId: post?.channel_id,
        timestamp: new Date().toISOString()
    });

    // Validate required post properties
    if (!post?.id || !post?.user_id || !post?.channel_id) {
        console.warn('⚠️ [PostReceipt] Invalid post:', {
            id: post?.id,
            userId: post?.user_id,
            channelId: post?.channel_id
        });
        return null;
    }

    const messageId = post.id;
    const [seenBy, setSeenBy] = useState<string[]>([]);
    const currentUserId = document.cookie.match(/MMUSERID=([^;]+)/)?.[1] || 
                         window.localStorage.getItem('MMUSERID') || '';

    if (!currentUserId) {
        console.warn('⚠️ [PostReceipt] No current user ID found');
        return null;
    }

    // Check if this is the user's own message
    const isOwnMessage = post.user_id === currentUserId;

    // Update local state from our store
    useEffect(() => {
        const receipts = getMessageReadReceipts(messageId);
        console.log('📥 [PostReceipt] Loading receipts:', {
            messageId,
            receipts,
            isOwnMessage,
            currentUserId,
            timestamp: new Date().toISOString()
        });
        setSeenBy(receipts);

        // Listen for store updates
        const handleStoreUpdate = (event: Event) => {
            const customEvent = event as StoreUpdateEvent;
            const { type, receipts } = customEvent.detail;
            
            console.log('🔄 [PostReceipt] Store update event:', {
                type,
                messageId,
                hasReceipts: !!receipts,
                timestamp: new Date().toISOString()
            });

            // If receipts are included in the event, use them directly
            if (type === 'receipts_loaded' && receipts) {
                const messageReceipt = receipts.find(r => r.messageId === messageId);
                if (messageReceipt) {
                    console.log('✨ [PostReceipt] Using receipt from event:', {
                        messageId,
                        users: messageReceipt.users
                    });
                    setSeenBy(messageReceipt.users);
                    return;
                }
            }

            // Fallback to getting from store
            setSeenBy(getMessageReadReceipts(messageId));
        };

        window.addEventListener(RECEIPT_STORE_UPDATE, handleStoreUpdate);
        return () => {
            window.removeEventListener(RECEIPT_STORE_UPDATE, handleStoreUpdate);
        };
    }, [messageId, currentUserId, isOwnMessage]);

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

    // Always filter out the current user from seen by list
    // In your own messages, show who has seen it
    // In others' messages, only show if the author has seen it
    const seenByOthers = seenBy.filter(id => {
        // Don't show yourself in seen-by list
        if (id === currentUserId) return false;
        
        if (isOwnMessage) {
            // In your messages, show everyone who has seen it
            return true;
        } else {
            // In others' messages, only show if you've seen it
            return false;
        }
    });
    const seenByOthersDisplay = seenByOthers.map(userId => getUserDisplayName(userId));

    console.log('👀 [PostReceipt] Preparing display:', {
        messageId,
        seenByOthers,
        seenByOthersDisplay,
        isOwnMessage,
        authorId: post.user_id,
        currentUserId,
        timestamp: new Date().toISOString()
    });

    return (
        <div 
            className="post-receipt-container" 
            data-post-id={messageId}
            data-component="post-receipt"
            data-is-own-message={isOwnMessage}
            data-author-id={post.user_id}
        >
            {/* Never include VisibilityTracker for own messages */}
            {!isOwnMessage && (
    <VisibilityTracker 
        messageId={messageId} 
        postAuthorId={post.user_id}
        channelId={post.channel_id}
        key={`tracker-${messageId}`}
    />
)}
            
            {seenByOthers.length > 0 && (
                <div 
                    className="post-receipt" 
                    style={{ 
                        fontSize: '11px', 
                        color: 'rgba(63, 67, 80, 0.72)',
                        padding: '4px 0',
                        marginTop: '2px',
                        display: 'inline-flex',
                        alignItems: 'center'
                    }}
                    data-seen-by={seenByOthers.join(',')}
                >
                    <span className="read-receipt-text">
                        Seen by {seenByOthersDisplay.join(', ')}
                    </span>
                </div>
            )}
        </div>
    );
};

export default PostReceipt;