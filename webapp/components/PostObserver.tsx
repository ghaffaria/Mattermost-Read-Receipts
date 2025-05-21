// webapp/components/PostObserver.tsx


import React, { useEffect } from 'react';

const PostObserver: React.FC = () => {
    useEffect(() => {
        console.log('🧿 [PostObserver] Effect triggered');

        const tryObserve = () => {
            const container =
                document.querySelector('.post-list__content') ||
                document.querySelector('[data-testid="postView"]')?.parentElement;

            if (!container) {
                console.warn('⚠️ Could not find post container, retrying...');
                setTimeout(tryObserve, 500); // Retry until DOM is ready
                return;
            }

            console.log('👁️ Starting MutationObserver on container:', container);

            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (!(node instanceof HTMLElement)) return;

                        const post = node.classList.contains('post')
                            ? node
                            : node.querySelector('.post');

                        if (post && !post.querySelector('.custom-read-receipt')) {
                            const postId = post.getAttribute('id') || '[no-id]';
                            console.log('👁️ New post detected:', postId);

                            const receipt = document.createElement('div');
                            receipt.className = 'custom-read-receipt';
                            receipt.textContent = '👁️';
                            receipt.style.marginLeft = '8px';
                            receipt.style.display = 'inline-block';
                            receipt.style.opacity = '0.5';

                            post.appendChild(receipt);
                        }
                    });
                });
            });

            observer.observe(container, { childList: true, subtree: true });

            console.log('👁️ MutationObserver attached.');

            return () => {
                observer.disconnect();
                console.log('👁️ PostObserver unmounted, observer disconnected');
            };
        };

        tryObserve();
    }, []);

    return null;
};

export default PostObserver;
