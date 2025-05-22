// webapp/components/PostObserver.tsx


import React, { useEffect } from 'react';

const injectEyes = () => {
    document.querySelectorAll('div.post').forEach(postDiv => {
        if (!postDiv.querySelector('.custom-read-receipt')) {
            const receipt = document.createElement('span');
            receipt.textContent = '👁️';
            receipt.className = 'custom-read-receipt';
            receipt.style.marginLeft = '8px';
            receipt.style.color = 'blue';
            const postBody = postDiv.querySelector('.post-message__text');
            if (postBody) {
                postBody.appendChild(receipt);
            } else {
                postDiv.appendChild(receipt);
            }
        }
    });
};

const PostObserver: React.FC = () => {
    useEffect(() => {
        // اجرای اولیه برای پست‌های موجود
        injectEyes();

        const container = document.getElementById('post-list') || document.querySelector('.post-list__content');
        if (!container) {
            console.warn('⚠️ Post list container not found!');
            return;
        }

        const observer = new MutationObserver(() => {
            // هر تغییری رخ داد، مجدداً بررسی و inject کن
            injectEyes();
        });

        observer.observe(container, { childList: true, subtree: true });

        return () => observer.disconnect();
    }, []);

    return null;
};

export default PostObserver;
