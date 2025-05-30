// webapp/components/PostReceipt.tsx
import React, { FC, ReactElement } from 'react';
import { useSelector, useStore } from 'react-redux';
import VisibilityTracker from './VisibilityTracker';
import { Post } from '../types/mattermost-webapp';
import { RootState } from '../store/types';
import { selectReaders } from '../store/channelReaders';
import { loadInitialReceipts } from '../store';
import styles from './PostReceipt.module.css';

interface PostReceiptProps {
    post: Post;
}

const PostReceipt: FC<PostReceiptProps> = ({ post }): ReactElement | null => {
    const contextStore = useStore(); // uses the Provider injected by RootObserver
    console.log('DEBUG: PostReceipt store instance:', contextStore);

    console.log('DEBUG: PostReceipt rendering...');
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
            // 1️⃣ try the expected nested shape
            let readers = selectReaders(state, post.channel_id, messageId);
            // 2️⃣ fallback to flat {postId: [...] } shape (seen in latest logs)
            if (readers.length === 0 && (state as any).channelReaders?.[messageId]) {
                readers = (state as any).channelReaders[messageId];
            }
            return readers;
        });
        console.log(`[PostReceipt:${messageId}] readerIds:`, readerIds);
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
            // inline style avoids missing-CSS crash
            return (<span style={{opacity:0.25, marginLeft:4}}>✓✓</span>);
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

        // Read receipts should ONLY be shown on the sender's own messages
        // If this is not the user's own message, only render the VisibilityTracker (if not seen)
        if (!isOwnMessage) {
            console.log('DEBUG: [PostReceipt] Not own message, only rendering VisibilityTracker if not seen');
            if (!seenBy) {
                return (
                    <VisibilityTracker 
                        messageId={messageId} 
                        postAuthorId={post.user_id}
                        channelId={post.channel_id}
                        key={`tracker-${messageId}`}
                    />
                );
            }
            return null; // Don't show read receipts for received messages
        }

        // From here on, we know it's the user's own message
        // Filter out current user from display list (they shouldn't see themselves in "Seen by")
        const seenByOthers = readerIds.filter(id => id !== currentUserId);

        // Get display names for readers using Mattermost's user profiles
        const seenByOthersDisplay = seenByOthers.map(userId => {
            // Access Mattermost's user profiles directly from the global window store
            try {
                const mattermostStore = (window as any).store;
                if (mattermostStore) {
                    const user = mattermostStore.getState()?.entities?.users?.profiles?.[userId];
                    if (user) {
                        // Priority: nickname > first+last name > username > fallback
                        const displayName = user.nickname || 
                                          `${user.first_name || ''} ${user.last_name || ''}`.trim() || 
                                          user.username ||
                                          `User ${userId.substring(0, 8)}`;
                        console.log('👤 [PostReceipt] User display name:', { userId, displayName, user });
                        return displayName;
                    }
                }
                console.warn('⚠️ [PostReceipt] User profile not found in Mattermost store:', userId);
                return `User ${userId.substring(0, 8)}`; // Fallback with shortened ID
            } catch (error) {
                console.error('❌ [PostReceipt] Error getting user display name:', error);
                return `User ${userId.substring(0, 8)}`; // Fallback with shortened ID
            }
        }).filter(name => name); // Filter out any empty names

        // If the message is seen or it's the user's own message, render the receipt
        // At this point we know it's the user's own message (due to early returns above)
        return (
            <div 
                className="post-receipt-container" 
                data-post-id={messageId}
                data-component="post-receipt"
                data-is-own-message={isOwnMessage}
                data-author-id={post.user_id}
            >
                {/* Only show "Seen by" if others have read the message */}
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