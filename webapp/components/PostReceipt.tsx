// webapp/components/PostReceipt.tsx
import React, { FC, ReactElement, useRef, useEffect } from 'react';
import { useSelector, useStore } from 'react-redux';
import VisibilityTracker from './VisibilityTracker';
import { Post } from '../types/mattermost-webapp';
import { RootState } from '../store/types';
import { selectReaders } from '../store/channelReaders';
import { loadInitialReceipts } from '../store';
import { reinitializeReadReceipts } from '../plugin';
import styles from './PostReceipt.module.css';

interface PostReceiptProps {
    post: Post;
}

const PostReceipt: FC<PostReceiptProps> = ({ post }): ReactElement | null => {
    const contextStore = useStore(); // uses the Provider injected by RootObserver
    const prevReadersRef = useRef<string[]>([]);
    const reinitAttemptedRef = useRef<boolean>(false);
    const reinitTimeoutRef = useRef<number | null>(null);

    console.log('🔎 [PostReceipt] Component rendering:', {
        postId: post?.id,
        isTargetPost: post?.id === 'fpb56zb5ptdemeywszqqo5tywa',
        storeAvailable: !!contextStore
    });

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
            console.log('🔍 [PostReceipt] Selector execution:', {
                postId: messageId,
                isTargetPost: messageId === 'fpb56zb5ptdemeywszqqo5tywa',
                channelId: post.channel_id,
                reduxState: {
                    hasChannelReaders: !!state.channelReaders,
                    channelState: state.channelReaders[post.channel_id],
                    postReaders: state.channelReaders[post.channel_id]?.[messageId]
                }
            });
            const readers = selectReaders(state, post.channel_id, messageId);
            console.log('📊 [PostReceipt] Selected readers:', {
                postId: messageId,
                isTargetPost: messageId === 'fpb56zb5ptdemeywszqqo5tywa',
                selectedReaders: readers,
                channelReadersState: state.channelReaders[post.channel_id]
            });
            return readers;
        });

        // Track reader changes
        useEffect(() => {
            if (messageId === 'fpb56zb5ptdemeywszqqo5tywa') {
                const addedReaders = readerIds.filter(id => !prevReadersRef.current.includes(id));
                const removedReaders = prevReadersRef.current.filter(id => !readerIds.includes(id));
                console.log('📱 [PostReceipt] Target post readers changed:', {
                    postId: messageId,
                    currentReaders: readerIds,
                    previousReaders: prevReadersRef.current,
                    addedReaders,
                    removedReaders,
                    timestamp: new Date().toISOString()
                });
                prevReadersRef.current = readerIds;
            }
        }, [readerIds, messageId]);

        // Get current user ID with improved logging
        const currentUserId = document.cookie.match(/MMUSERID=([^;]+)/)?.[1] || 
                             window.localStorage.getItem('MMUSERID') || '';
        // Check if this is the user's own message
        const isOwnMessage = post.user_id === currentUserId;

        console.log('👤 [PostReceipt] User context:', {
            postId: messageId,
            isTargetPost: messageId === 'fpb56zb5ptdemeywszqqo5tywa',
            currentUserId,
            postAuthorId: post.user_id,
            isOwnMessage
        });

        // Track if state has loaded
        const [hasLoadedState, setHasLoadedState] = React.useState(false);
        React.useEffect(() => {
            setHasLoadedState(true);
            if (messageId === 'fpb56zb5ptdemeywszqqo5tywa') {
                console.log('🔄 [PostReceipt] Target post state loaded:', {
                    messageId,
                    readerCount: readerIds.length,
                    readers: readerIds,
                    isOwnMessage,
                    currentUserId
                });
            }
        }, [readerIds, messageId, isOwnMessage, currentUserId]);

        // If the state hasn't loaded yet, show skeleton
        if (!hasLoadedState) {
            console.log('⌛ [PostReceipt] State loading:', {
                postId: messageId,
                isTargetPost: messageId === 'fpb56zb5ptdemeywszqqo5tywa'
            });
            return (<span style={{opacity:0.25, marginLeft:4}}>✓✓</span>);
        }

        // If there are no readers, don't render the receipt (but still render VisibilityTracker if not own message)
        if (readerIds.length === 0) {
            if (!isOwnMessage) {
                console.log('👁️ [PostReceipt] No readers, showing tracker:', {
                    postId: messageId,
                    isTargetPost: messageId === 'fpb56zb5ptdemeywszqqo5tywa',
                    authorId: post.user_id,
                    channelId: post.channel_id
                });
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

        // Determine if the message has been seen by the current user
        const seenBy = readerIds.includes(currentUserId);
        
        if (messageId === 'fpb56zb5ptdemeywszqqo5tywa') {
            console.log('👀 [PostReceipt] Target post seen status:', {
                seenBy,
                currentUserId,
                readerIds,
                isOwnMessage
            });
        }

        // Read receipts should ONLY be shown on the sender's own messages
        // If this is not the user's own message, only render the VisibilityTracker (if not seen)
        if (!isOwnMessage) {
            if (!seenBy) {
                console.log('👁️ [PostReceipt] Not own message, showing tracker:', {
                    postId: messageId,
                    isTargetPost: messageId === 'fpb56zb5ptdemeywszqqo5tywa'
                });
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
            try {
                const mattermostStore = (window as any).store;
                if (mattermostStore) {
                    const user = mattermostStore.getState()?.entities?.users?.profiles?.[userId];
                    if (user) {
                        const displayName = user.nickname || 
                                       `${user.first_name || ''} ${user.last_name || ''}`.trim() || 
                                       user.username ||
                                       `User ${userId.substring(0, 8)}`;
                        if (messageId === 'fpb56zb5ptdemeywszqqo5tywa') {
                            console.log('👤 [PostReceipt] Target post reader profile:', {
                                userId,
                                displayName,
                                hasNickname: !!user.nickname,
                                hasName: !!(user.first_name || user.last_name),
                                hasUsername: !!user.username
                            });
                        }
                        return displayName;
                    }
                }
                console.warn('⚠️ [PostReceipt] User profile not found:', userId);
                return `User ${userId.substring(0, 8)}`;
            } catch (error) {
                console.error('❌ [PostReceipt] Error getting display name:', {
                    userId,
                    error: error instanceof Error ? error.message : String(error)
                });
                return `User ${userId.substring(0, 8)}`;
            }
        }).filter(name => name);

        // Return the receipt UI
        return (
            <div 
                className="post-receipt-container" 
                data-post-id={messageId}
                data-component="post-receipt"
                data-is-own-message={isOwnMessage}
                data-author-id={post.user_id}
            >
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
        console.error('❌ [PostReceipt] Error in component:', {
            error: error instanceof Error ? error.message : String(error),
            post: {
                id: post?.id,
                userId: post?.user_id,
                channelId: post?.channel_id
            }
        });
        return null;
    }
};

export default PostReceipt;