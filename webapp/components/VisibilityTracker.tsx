import React, {useEffect, useRef} from 'react';
import debounce from 'lodash.debounce';

interface VisibilityTrackerProps {
    messageId: string;
}

const VisibilityTracker: React.FC<VisibilityTrackerProps> = ({messageId}) => {
    const observerRef = useRef<IntersectionObserver | null>(null);
    const elementRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const handleVisibilityChange = debounce((isVisible: boolean) => {
            if (isVisible) {
                // Send POST request to the server when the element is fully visible.
                fetch('/plugins/mattermost-readreceipts/api/v1/read', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({message_id: messageId}),
                }).catch((error) => {
                    console.error('Failed to send read receipt:', error);
                });
            }
        }, 300); // Debounce for 300ms

        const observerCallback: IntersectionObserverCallback = (entries) => {
            entries.forEach((entry) => {
                handleVisibilityChange(entry.isIntersecting);
            });
        };

        observerRef.current = new IntersectionObserver(observerCallback, {
            threshold: 1.0, // Fully visible
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
    }, [messageId]);

    return <div ref={elementRef} data-post-id={messageId}></div>;
};

export default VisibilityTracker;
