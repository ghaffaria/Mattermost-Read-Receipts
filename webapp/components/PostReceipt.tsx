// webapp/components/PostReceipt.tsx
import React, { FC, ReactElement, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { getUserDisplayName, RECEIPT_STORE_UPDATE } from '../store';
import { selectReaders } from '../store/channelReaders';
import { ensureStoreInitialized } from '../store/pluginStore';
import VisibilityTracker from './VisibilityTracker';
import { Post } from '../types/mattermost-webapp';
import { RootState } from '../store/types';

interface PostReceiptProps {
    post: Post;
}

const PostReceipt: FC<PostReceiptProps> = ({ post }): ReactElement | null => {
    try {
        // Ensure store is initialized before rendering
        ensureStoreInitialized();

        // Early returns for invalid posts
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
        const [hasLoadedState, setHasLoadedState] = useState(false);
        
        // Get current user ID
        const currentUserId = document.cookie.match(/MMUSERID=([^;]+)/)?.[1] || 
                             window.localStorage.getItem('MMUSERID') || '';

        // Early return if no user ID (not logged in)
        if (!currentUserId) {
            console.warn('⚠️ [PostReceipt] No current user ID found');
            return null;
        }

        // Check if this is the user's own message
        const isOwnMessage = post.user_id === currentUserId;

        // Get readers from Redux store using proper selector with null check
        const readerIds = useSelector((state: RootState) => {
            if (!state?.channelReaders) {
                console.warn('⚠️ [PostReceipt] Redux state not initialized:', {
                    messageId,
                    hasState: !!state,
                    hasChannelReaders: state && 'channelReaders' in state
                });
                return [];
            }
            return selectReaders(state, post.channel_id, messageId);
        });

        // Update local state when Redux state changes
        useEffect(() => {
            console.log('📥 [PostReceipt] Readers updated from Redux:', {
                messageId,
                readerIds,
                isOwnMessage,
                currentUserId,
                timestamp: new Date().toISOString()
            });
            setSeenBy(readerIds);
            setHasLoadedState(true);
        }, [messageId, readerIds, isOwnMessage, currentUserId]);

        // Don't render until we have the initial state
        if (!hasLoadedState) {
            return null;
        }

        // Filter out current user from display list if this is their message
        const seenByOthers = isOwnMessage ? 
            seenBy.filter(id => id !== currentUserId) : 
            seenBy;

        // Get display names for readers
        const seenByOthersDisplay = seenByOthers.map(userId => {
            try {
                return getUserDisplayName(userId);
            } catch (error) {
                console.warn(`⚠️ [PostReceipt] Could not get display name for user ${userId}:`, error);
                return userId;
            }
        });

        // Don't show anything if no other users have seen the message
        if (seenByOthers.length === 0) {
            return null;
        }

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
    } catch (error) {
        console.error('❌ [PostReceipt] Error in PostReceipt component:', error);
        return null;
    }
};

export default PostReceipt;