// webapp/components/VisibilityTracker.tsx


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
        console.log(`👁️ VisibilityTracker mounted for message ID: ${messageId}`);

        const handleVisibilityChange = debounce((isVisible: boolean) => {
            console.log(`🔍 Message ${messageId} visibility changed: ${isVisible}`);
            if (isVisible && !hasSent) {
                console.log(`📤 Sending read receipt for message: ${messageId}`);

                fetch('/plugins/mattermost-readreceipts/api/v1/read', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ message_id: messageId }),
                })
                    .then((res) => {
                        console.log(`✅ Read receipt sent for ${messageId}, status: ${res.status}`);
                        setHasSent(true);
                    })
                    .catch((error) => {
                        console.error(`❌ Failed to send read receipt for ${messageId}:`, error);
                    });
            }
        }, 300);

        const observerCallback: IntersectionObserverCallback = (entries) => {
            entries.forEach((entry) => {
                handleVisibilityChange(entry.isIntersecting);
            });
        };

        observerRef.current = new IntersectionObserver(observerCallback, {
            threshold: 1.0,
        });

        if (elementRef.current) {
            console.log(`📌 Observing DOM element for message: ${messageId}`);
            observerRef.current.observe(elementRef.current);
        } else {
            console.warn(`⚠️ elementRef is null for message: ${messageId}`);
        }

        return () => {
            if (observerRef.current && elementRef.current) {
                observerRef.current.unobserve(elementRef.current);
                console.log(`🧹 Unobserved element for message: ${messageId}`);
            }
            observerRef.current = null;
        };
    }, [messageId, hasSent]);

    return <div ref={elementRef} data-post-id={messageId}></div>;
};

export default VisibilityTracker;
