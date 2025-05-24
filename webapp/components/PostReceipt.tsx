// webapp/components/PostReceipt.tsx
import React, { FC, ReactElement, useEffect, useState } from 'react';
import { getMessageReadReceipts, getUserDisplayName, updateReadReceipts } from '../store';
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
        hasPost: !!post
    });

    if (!post?.id) {
        console.warn('⚠️ [PostReceipt] Invalid post:', post);
        return null;
    }

    const messageId = post.id;
    const [seenBy, setSeenBy] = useState<string[]>([]);
    const currentUserId = window.localStorage.getItem('MMUSERID') || '';

    // Update local state from our store
    useEffect(() => {
        const receipts = getMessageReadReceipts(messageId);
        console.log('📥 [PostReceipt] Loading initial receipts:', {
            messageId,
            receipts,
            currentState: seenBy
        });
        setSeenBy(receipts);
    }, [messageId]);

    // Fetch initial receipts from server
    useEffect(() => {
        const fetchReceipts = async () => {
            try {
                console.log(`🔍 [PostReceipt] Fetching receipts for message:`, messageId);
                const response = await fetch(`/plugins/mattermost-readreceipts/api/v1/receipts?message_id=${messageId}`);
                
                if (response.ok) {
                    const data = await response.json();
                    console.log(`✅ [PostReceipt] Server response:`, {
                        messageId,
                        data,
                        status: response.status
                    });
                    
                    const seenByUsers = data.seen_by || [];
                    
                    // Update both local state and store
                    seenByUsers.forEach((userId: string) => {
                        console.log('👤 [PostReceipt] Processing user:', {
                            messageId,
                            userId,
                            displayName: getUserDisplayName(userId)
                        });
                        updateReadReceipts(messageId, userId);
                    });
                    
                    setSeenBy(seenByUsers);
                } else {
                    console.error('❌ [PostReceipt] Server error:', {
                        status: response.status,
                        statusText: response.statusText,
                        messageId
                    });
                }
            } catch (error) {
                console.error('❌ [PostReceipt] Fetch error:', {
                    error,
                    messageId
                });
            }
        };

        fetchReceipts();
    }, [messageId]);

    // Handle WebSocket events
    useEffect(() => {
        const handleWebSocketEvent = (event: Event) => {
            const customEvent = event as CustomEvent<WebSocketEventData>;
            console.log('📡 [PostReceipt] WebSocket event received:', {
                type: customEvent.detail.event,
                data: customEvent.detail.data
            });

            if (customEvent.detail.event === 'custom_mattermost-readreceipts_read_receipt') {
                const { message_id, user_id } = customEvent.detail.data;
                if (message_id === messageId) {
                    console.log('👁️ [PostReceipt] Processing receipt:', {
                        messageId: message_id,
                        userId: user_id,
                        username: getUserDisplayName(user_id),
                        currentSeenBy: seenBy
                    });

                    // Update both store and local state
                    updateReadReceipts(message_id, user_id);
                    setSeenBy(prev => {
                        const newState = !prev.includes(user_id) ? [...prev, user_id] : prev;
                        console.log('✅ [PostReceipt] State updated:', {
                            previous: prev,
                            new: newState,
                            changed: prev.length !== newState.length
                        });
                        return newState;
                    });
                } else {
                    console.log('⏭️ [PostReceipt] Ignoring event for different message:', {
                        eventMessageId: message_id,
                        ourMessageId: messageId
                    });
                }
            }
        };

        console.log('👂 [PostReceipt] Adding WebSocket listener for:', messageId);
        window.addEventListener('mattermost-websocket-event', handleWebSocketEvent as EventListener);
        return () => {
            console.log('🗑️ [PostReceipt] Removing WebSocket listener for:', messageId);
            window.removeEventListener('mattermost-websocket-event', handleWebSocketEvent as EventListener);
        };
    }, [messageId, seenBy]);

    const seenByOthers = seenBy.filter(id => id !== currentUserId);
    const seenByOthersDisplay = seenByOthers.map(userId => getUserDisplayName(userId));

    console.log('👀 [PostReceipt] Preparing display:', {
        messageId,
        seenBy,
        seenByOthers,
        seenByOthersDisplay,
        currentUserId
    });

    const content = seenByOthers.length > 0 ? (
        <div className="post-receipt" style={{ fontSize: '12px', color: '#666' }}>
            <span className="eye-icon">👁</span>
            <div className="tooltip">
                Seen by: {seenByOthersDisplay.join(', ')}
            </div>
        </div>
    ) : null;

    return content && (
        <div style={{ padding: '4px', marginTop: '4px' }}>
            <VisibilityTracker messageId={messageId} />
            {content}
        </div>
    );
};

export default PostReceipt;