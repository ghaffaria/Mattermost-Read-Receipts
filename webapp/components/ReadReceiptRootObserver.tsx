// webapp/components/ReadReceiptRootObserver.tsx
import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import PostReceipt from './PostReceipt';
import { Post } from '../types/mattermost-webapp';

interface MattermostState {
    entities: {
        posts: {
            posts: {
                [postId: string]: {
                    id: string;
                    user_id: string;
                    channel_id: string;
                };
            };
        };
    };
}

const getAuthorId = (postId: string): string => {
    const state = (window as any).store?.getState?.();
    const post = state?.entities?.posts?.posts?.[postId];
    console.log('🔍 [RootObserver] Getting author from store:', {
        postId,
        authorId: post?.user_id,
        hasPost: !!post
    });
    return post?.user_id || '';
};

const ReadReceiptRootObserver: React.FC = () => {
    useEffect(() => {
        let observer: MutationObserver | null = null;
        let polling: number | null = null;
        let tries = 0;

        // Handle posts that we detect
        function handlePostNode(node: HTMLElement) {
            const id = node.id || node.getAttribute('id') || '';
            const postId = id.replace(/^post_/, '');
            if (!postId) {
                console.warn('⚠️ [RootObserver] Post node without ID:', node);
                return;
            }

            console.log('📨 [RootObserver] Processing post:', {
                postId,
                nodeId: id,
                hasReceiptContainer: node.querySelector('.post-receipt-container') !== null
            });

            // Check if we already attached a receipt
            if (node.querySelector('.post-receipt-container')) {
                console.log('ℹ️ [RootObserver] Receipt already attached:', postId);
                return;
            }

            // Find or create the container for our receipt component
            let receiptContainer = node.querySelector('.post-receipt-mount-point');
            if (!receiptContainer) {
                console.log('🏗️ [RootObserver] Creating receipt container for:', postId);
                receiptContainer = document.createElement('div');
                receiptContainer.className = 'post-receipt-mount-point';
                
                // Find the post message and insert after it
                const messageContainer = node.querySelector('.post-message__text') || 
                                      node.querySelector('.post__body');
                if (messageContainer && messageContainer.parentNode) {
                    messageContainer.parentNode.insertBefore(receiptContainer, messageContainer.nextSibling);
                } else {
                    console.warn('⚠️ [RootObserver] Could not find message container:', postId);
                    return;
                }
            }

            // Get post author_id from Redux store
            const authorId = getAuthorId(postId);
            // Get channel_id from Redux store
            const state = (window as any).store?.getState?.();
            const post = state?.entities?.posts?.posts?.[postId];
            const channelId = post?.channel_id;

            console.log('🎨 [RootObserver] Rendering PostReceipt for:', {
                postId,
                authorId,
                channelId,
                source: 'redux_store'
            });

            if (!channelId) {
                console.warn('⚠️ [RootObserver] Could not find channel_id for post:', postId);
                return;
            }

            ReactDOM.render(
                <PostReceipt post={{ id: postId, user_id: authorId, channel_id: channelId }} />,
                receiptContainer
            );
        }

        function tryAttachObserver() {
            // Find the messages container (handle different Mattermost versions)
            const possibleSelectors = [
                '.post-list__content',
                '.post-list__body',
                '.post-list',
                '[role="main"]'
            ];
            let target: Element | null = null;
            for (const sel of possibleSelectors) {
                target = document.querySelector(sel);
                if (target) break;
            }

            if (target) {
                observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        mutation.addedNodes.forEach((node) => {
                            // Handle both direct post nodes and containers that might contain posts
                            if (node instanceof HTMLElement) {
                                if (node.matches('[data-testid="postView"]')) {
                                    handlePostNode(node);
                                }
                                // Also check for posts within this node
                                node.querySelectorAll('[data-testid="postView"]').forEach((el) => {
                                    handlePostNode(el as HTMLElement);
                                });
                            }
                        });
                    });
                });
                
                observer.observe(target, { childList: true, subtree: true });
                console.log('👀 [RootObserver] Attached to:', target);

                // Also handle any existing posts
                target.querySelectorAll('[data-testid="postView"]').forEach((node) => {
                    handlePostNode(node as HTMLElement);
                });

                if (polling) {
                    window.clearInterval(polling);
                }
            } else {
                tries += 1;
                if (tries > 100) {
                    if (polling) {
                        window.clearInterval(polling);
                    }
                    console.warn('⚠️ [RootObserver] No container found after 10s');
                }
            }
        }

        polling = window.setInterval(tryAttachObserver, 100);
        tryAttachObserver();

        return () => {
            if (polling) {
                window.clearInterval(polling);
            }
            if (observer) {
                observer.disconnect();
            }
        };
    }, []);

    return null;
};

export default ReadReceiptRootObserver;
