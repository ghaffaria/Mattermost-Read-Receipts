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
    const [isVisible, setIsVisible] = useState(false);
    const visibilityTimeout = useRef<number | null>(null);

    const sendReadReceipt = async () => {
        if (hasSent) return;

        console.log(`📤 [VisibilityTracker] Sending read receipt for: ${messageId}`);
        try {
            const response = await fetch('/plugins/mattermost-readreceipts/api/v1/read', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': window.localStorage.getItem('MMCSRF') || 
                                  (document.cookie.match(/MMCSRF=([^;]+)/)||[])[1] || ''
                },
                credentials: 'same-origin',
                body: JSON.stringify({ message_id: messageId }),
            });

            if (response.ok) {
                console.log(`✅ [VisibilityTracker] Read receipt sent for ${messageId}`);
                setHasSent(true);
            } else {
                throw new Error(`Server returned ${response.status}`);
            }
        } catch (error) {
            console.error(`❌ [VisibilityTracker] Failed to send read receipt for ${messageId}:`, error);
        }
    };

    const handleVisibilityChange = debounce((entries: IntersectionObserverEntry[]) => {
        const entry = entries[0];
        const newIsVisible = entry.isIntersecting;
        
        console.log(`👁️ [VisibilityTracker] ${messageId} visibility changed:`, {
            isIntersecting: newIsVisible,
            ratio: entry.intersectionRatio,
            hasSent
        });

        setIsVisible(newIsVisible);

        // Clear any existing timeout
        if (visibilityTimeout.current) {
            window.clearTimeout(visibilityTimeout.current);
            visibilityTimeout.current = null;
        }

        // If message becomes visible and we haven't sent a receipt yet
        if (newIsVisible && !hasSent) {
            // Set a timeout to ensure the message is actually read (2 seconds of visibility)
            visibilityTimeout.current = window.setTimeout(() => {
                if (isVisible && !hasSent) {
                    sendReadReceipt();
                }
            }, 2000);
        }
    }, 100);

    useEffect(() => {
        console.log(`🔄 [VisibilityTracker] Setting up observer for ${messageId}`);
        
        if (elementRef.current && !observerRef.current) {
            observerRef.current = new IntersectionObserver(handleVisibilityChange, {
                threshold: [0.5], // Message must be 50% visible
                rootMargin: '0px'
            });
            
            observerRef.current.observe(elementRef.current);
        }

        return () => {
            console.log(`🧹 [VisibilityTracker] Cleaning up observer for ${messageId}`);
            if (visibilityTimeout.current) {
                window.clearTimeout(visibilityTimeout.current);
            }
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, [messageId]);

    return (
        <div 
            ref={elementRef}
            style={{ width: '1px', height: '1px', opacity: 0 }}
            data-testid="visibility-tracker"
            data-message-id={messageId}
        />
    );
};

export default VisibilityTracker;
