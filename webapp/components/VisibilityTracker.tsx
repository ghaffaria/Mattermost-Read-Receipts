// webapp/components/VisibilityTracker.tsx


import React, { FC, ReactElement, useEffect, useRef, useState } from 'react';
import debounce from 'lodash.debounce';

interface VisibilityTrackerProps {
    messageId: string;
}

const VisibilityTracker: FC<VisibilityTrackerProps> = ({ messageId }): ReactElement => {
    const observerRef = useRef<IntersectionObserver | null>(null);
    const elementRef = useRef<HTMLDivElement | null>(null);
    const [hasSent, setHasSent] = useState(false); // avoid re-sending

    useEffect(() => {
        const handleVisibilityChange = debounce((isVisible: boolean) => {
            if (isVisible && !hasSent) {
                fetch('/plugins/mattermost-readreceipts/api/v1/read', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ message_id: messageId }),
                }).then(() => {
                    setHasSent(true);
                }).catch((error) => {
                    console.error('Failed to send read receipt:', error);
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
            observerRef.current.observe(elementRef.current);
        }

        return () => {
            if (observerRef.current && elementRef.current) {
                observerRef.current.unobserve(elementRef.current);
            }
            observerRef.current = null;
        };
    }, [messageId, hasSent]);

    return <div ref={elementRef} data-post-id={messageId}></div>;
};

export default VisibilityTracker;
