// webapp/components/ReadReceiptRootObserver.tsx
import React, { useEffect } from 'react';

// Set برای جلوگیری از ارسال مجدد برای هر پیام
const sentReceipts = new Set<string>();

const ReadReceiptRootObserver: React.FC = () => {
    useEffect(() => {
        let observer: MutationObserver | null = null;
        let polling: number | null = null;
        let tries = 0;

        function tryAttachObserver() {
            // پیدا کردن container پیام‌ها (در صورت تغییر DOM در نسخه‌های مختلف Mattermost)
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
                            // اگر خودش یک post است:
                            if (
                                node instanceof HTMLElement &&
                                node.matches('[data-testid="postView"]')
                            ) {
                                handlePostNode(node);
                            }
                            // یا اگر داخل این node چند post وجود دارد:
                            if (node instanceof HTMLElement) {
                                node.querySelectorAll?.('[data-testid="postView"]').forEach((el) => {
                                    handlePostNode(el as HTMLElement);
                                });
                            }
                        });
                    }
                });
                observer.observe(target, { childList: true, subtree: true });
                console.log('[ReadReceipt][RootObserver] MutationObserver attached to', target);
                if (polling) clearInterval(polling);
            } else {
                tries += 1;
                if (tries > 100) { // حدود ۱۰ ثانیه تلاش
                    if (polling) clearInterval(polling);
                    console.warn('[ReadReceipt][RootObserver] No post-list container found after 10s!');
                }
            }
        }

        // هندل کردن ارسال read receipt فقط یک بار برای هر پیام
        function handlePostNode(node: HTMLElement) {
            const id = node.id || node.getAttribute('id') || '';
            const postId = id.replace(/^post_/, '');
            if (!postId) return;

            if (!sentReceipts.has(postId)) {
                sentReceipts.add(postId);
                console.log('[ReadReceipt][RootObserver] NEW post:', postId, node);

                // ارسال read receipt به سرور پلاگین
                fetch('/plugins/mattermost-readreceipts/api/v1/read', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Mattermost-User-Id': window.localStorage.getItem('MMUSERID') || '',
                        'X-CSRF-Token': document.cookie.match(/MMCSRF=([^;]+)/)?.[1] || '',
                    },
                    body: JSON.stringify({ message_id: postId }),
                    credentials: 'same-origin', 
                })
                .then(res => {
                    if (res.ok) {
                        console.log('[ReadReceipt][RootObserver] ✅ Read receipt sent for:', postId);
                    } else {
                        console.warn('[ReadReceipt][RootObserver] ❌ Failed to send read receipt for:', postId, res.status);
                    }
                })
                .catch(err => {
                    console.error('[ReadReceipt][RootObserver] ❌ Fetch error for:', postId, err);
                });
            }
        }

        polling = setInterval(tryAttachObserver, 100);
        tryAttachObserver();

        return () => {
            if (polling) clearInterval(polling);
            if (observer) observer.disconnect();
        };
    }, []);

    return null;
};

export default ReadReceiptRootObserver;
