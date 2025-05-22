// webapp/index.tsx

/// <reference path="./types/mattermost-webapp.d.ts" />


import Plugin from './index'; 


try {
    (window as any).registerPlugin('mattermost-readreceipts', new Plugin());
    console.log('✅ Plugin registered successfully.');
} catch (error) {
    console.error('❌ Failed to register plugin:', error);
}

console.log("🟢 Custom JS from plugin loaded!");
(function injectReadReceiptsIcon() {
    function addIconToPosts() {
        document.querySelectorAll('.post').forEach(post => {
            if (!post.querySelector('.custom-read-receipt')) {
                const postHeader = post.querySelector('.post__header');
                if (postHeader) {
                    const icon = document.createElement('span');
                    icon.textContent = '👁️';
                    icon.className = 'custom-read-receipt';
                    icon.style.marginLeft = '8px';
                    icon.style.opacity = '0.7';
                    icon.style.cursor = 'pointer';
                    postHeader.appendChild(icon);
                }
            }
        });
    }

    addIconToPosts();

    const container = document.querySelector('.post-list__content') ||
        document.querySelector('[data-testid="postView"]')?.parentElement;
    if (!container) return;

    const observer = new MutationObserver(addIconToPosts);
    observer.observe(container, { childList: true, subtree: true });
})();
