// webapp/components/PostReceipt.tsx
import React, { FC, ReactElement } from 'react';
import { useSelector, useStore } from 'react-redux';
import { ensureStoreInitialized } from '../store/pluginStore';
import VisibilityTracker from './VisibilityTracker';
import { Post } from '../types/mattermost-webapp';
import { RootState } from '../store/types';
import { selectReaders } from '../store/channelReaders';
import styles from './PostReceipt.module.css';

interface PostReceiptProps {
    post: Post;
}

const PostReceipt: FC<PostReceiptProps> = ({ post }): ReactElement | null => {
    const contextStore = useStore();
    console.log('DEBUG: useStore() in PostReceipt context:', contextStore);

    console.log('DEBUG: PostReceipt rendering, calling ensureStoreInitialized...');
    try {
        ensureStoreInitialized();
        console.log('DEBUG: ensureStoreInitialized succeeded.');
    } catch (e) {
        console.error('DEBUG: ensureStoreInitialized failed:', e);
    }

    try {
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
        const readerIds = useSelector((state: RootState) => {
            console.log('DEBUG: [PostReceipt] State in useSelector for post:', post.id, JSON.stringify(state));
            if (!state) {
                console.error('CRITICAL DEBUG: [PostReceipt] state is null/undefined inside useSelector for post:', post.id);
                return [];
            }
            if (!state.channelReaders) {
                console.warn('⚠️ [PostReceipt] Redux state.channelReaders is missing for post:', post.id, 'State keys:', Object.keys(state));
                return [];
            }
            return selectReaders(state, post.channel_id, messageId);
        });
        console.log('DEBUG: [PostReceipt] readerIds:', readerIds);
        console.log('DEBUG: [PostReceipt] readerIds after useSelector:', readerIds, 'for post:', messageId);

        // Get current user ID
        const currentUserId = document.cookie.match(/MMUSERID=([^;]+)/)?.[1] || 
                             window.localStorage.getItem('MMUSERID') || '';
        // Check if this is the user's own message
        const isOwnMessage = post.user_id === currentUserId;

        // Track if state has loaded
        const [hasLoadedState, setHasLoadedState] = React.useState(false);
        React.useEffect(() => {
            setHasLoadedState(true);
        }, [readerIds, messageId, isOwnMessage, currentUserId]);

        // If the state hasn't loaded yet, show skeleton
        if (!hasLoadedState) {
            console.log('DEBUG: [PostReceipt] hasLoadedState is false, showing skeleton for post:', messageId);
            return (<span className={styles['seen-skeleton']}>✓✓</span>);
        }

        // If there are no readers, don't render the receipt (but still render VisibilityTracker if not own message)
        if (readerIds.length === 0) {
            if (!isOwnMessage) {
                return (
                    <VisibilityTracker 
                        messageId={messageId} 
                        postAuthorId={post.user_id}
                        channelId={post.channel_id}
                        key={`tracker-${messageId}`}
                    />
                );
            }
            return null;
        }

        // Early return if no user ID (not logged in)
        if (!currentUserId) {
            console.warn('⚠️ [PostReceipt] No current user ID found');
            return null;
        }

        // Determine if the message has been seen by the current user (using channelReaders only)
        const seenBy = readerIds.includes(currentUserId);

        console.log('DEBUG: [PostReceipt] seenBy:', seenBy);

        // Render nothing if the message is not seen by the current user and it's not their own message
        if (!seenBy && !isOwnMessage) {
            console.log('DEBUG: [PostReceipt] Message not seen by user and not own message, not rendering receipt.');
            return null;
        }

        // Filter out current user from display list if this is their message
        const seenByOthers = isOwnMessage ? readerIds.filter(id => id !== currentUserId) : readerIds;

        // Get display names for readers
        const seenByOthersDisplay = seenByOthers.map(userId => {
            // You may want to implement a getUserDisplayName util or use userId directly
            return userId;
        });

        // If the message is seen or it's the user's own message, render the receipt
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