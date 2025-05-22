// webapp/components/VisibilityTracker.tsx
console.log("👁️ VisibilityTracker mounted!");
import React, { FC, ReactElement, useEffect, useRef, useState } from 'react';
import debounce from 'lodash.debounce';

interface VisibilityTrackerProps {
    messageId: string;
}

const VisibilityTracker: FC<VisibilityTrackerProps> = ({ messageId }): ReactElement => {
    const observerRef = useRef<IntersectionObserver | null>(null);
    const elementRef = useRef<HTMLDivElement | null>(null);
    const [hasSent, setHasSent] = useState(false);

    useEffect(() => {
        console.log("👀 VisibilityTracker mounted for", messageId);

        console.log(`👁️ [VisibilityTracker] Mounted for message ID: ${messageId}`);

        const handleVisibilityChange = debounce((isVisible: boolean) => {
            console.log(`🔍 [VisibilityTracker] ${messageId} visibility changed: ${isVisible}`);
            if (isVisible && !hasSent) {
                console.log(`📤 [VisibilityTracker] Sending read receipt for message: ${messageId}`);
                fetch('/plugins/mattermost-readreceipts/api/v1/read', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ message_id: messageId }),
                })
                    .then((res) => {
                        console.log(`✅ [VisibilityTracker] Read receipt sent for ${messageId}, status: ${res.status}`);
                        setHasSent(true);
                    })
                    .catch((error) => {
                        console.error(`❌ [VisibilityTracker] Failed to send read receipt for ${messageId}:`, error);
                    });
            }
        }, 300);

        const observerCallback: IntersectionObserverCallback = (entries) => {
            entries.forEach((entry) => {
                console.log(`[TEST] entry.isIntersecting for message: ${messageId}:`, entry.isIntersecting, entry);
                handleVisibilityChange(entry.isIntersecting);
            });
        };

        observerRef.current = new window.IntersectionObserver(observerCallback, {
            threshold: 0.1,
        });

        // استفاده از setTimeout جهت اطمینان از آماده بودن DOM
        setTimeout(() => {
            if (elementRef.current) {
                console.log(`📌 [VisibilityTracker] Observing DOM element for message: ${messageId}`, elementRef.current);
                observerRef.current?.observe(elementRef.current);
            } else {
                console.warn(`⚠️ [VisibilityTracker] elementRef is null for message: ${messageId}`);
            }
        }, 0);

        return () => {
            if (observerRef.current && elementRef.current) {
                observerRef.current.unobserve(elementRef.current);
                console.log(`🧹 [VisibilityTracker] Unobserved element for message: ${messageId}`);
            }
            observerRef.current?.disconnect();
            observerRef.current = null;
        };
    }, [messageId, hasSent]);

    // اگر خواستی مطمئن باشی دقیقاً بعد از بدنه پیام وصل می‌شه، می‌تونی
    // style یا placement را تغییر بدی
    return (
        <div
            ref={elementRef}
            data-post-id={messageId}
            style={{height: '1px', width: '100%'}}
        >
            &nbsp;
        </div>
    );
};

export default VisibilityTracker;
