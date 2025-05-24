// webapp/components/ReadReceiptRootObserver.tsx
import React, { useEffect } from 'react';

const ReadReceiptRootObserver: React.FC = () => {
    useEffect(() => {
        let observer: MutationObserver | null = null;
        let polling: number | null = null;
        let tries = 0;

        function tryAttachObserver() {
            // Find the messages container (handle different Mattermost versions)
            const possibleSelectors = [
                '.post-list__content',
                '.post-list__body',
                '.post-list',
                '[role="main"]',
            ];
            let target: Element | null = null;
            for (const sel of possibleSelectors) {
                target = document.querySelector(sel);
                if (target) break;
            }

            if (target) {
                observer = new MutationObserver((mutations) => {
                    for (const mutation of mutations) {
                        mutation.addedNodes.forEach((node) => {
                            // If it's a post itself
                            if (
                                node instanceof HTMLElement &&
                                node.matches('[data-testid="postView"]')
                            ) {
                                handlePostNode(node);
                            }
                            // Or if it contains posts
                            if (node instanceof HTMLElement) {
                                node.querySelectorAll?.('[data-testid="postView"]').forEach((el) => {
                                    handlePostNode(el as HTMLElement);
                                });
                            }
                        });
                    }
                });
                observer.observe(target, { childList: true, subtree: true });
                console.log('👀 [RootObserver] Attached to:', target);
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

        // Log new posts but don't send read receipts immediately
        function handlePostNode(node: HTMLElement) {
            const id = node.id || node.getAttribute('id') || '';
            const postId = id.replace(/^post_/, '');
            if (!postId) return;

            console.log('📨 [RootObserver] New post:', postId);
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
