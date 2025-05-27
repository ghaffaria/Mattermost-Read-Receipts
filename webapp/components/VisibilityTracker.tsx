// webapp/components/VisibilityTracker.tsx
import React, { FC, ReactElement, useEffect, useRef, useState } from 'react';
import debounce from 'lodash.debounce';
import { visibilityThresholdMs, updateReadReceipts } from '../store';

interface VisibilityTrackerProps {
    messageId: string;
    postAuthorId: string;
    channelId: string;
    onVisible?: (messageId: string) => void;
}

const VisibilityTracker: FC<VisibilityTrackerProps> = ({ 
    messageId, 
    postAuthorId,
    channelId, 
    onVisible 
}): ReactElement => {
    const observerRef = useRef<IntersectionObserver | null>(null);
    const elementRef = useRef<HTMLDivElement | null>(null);
    const [hasSent, setHasSent] = useState(false);
    const visibilityStartTime = useRef<number | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const getUserId = (): string => {
        let userId = window.localStorage.getItem('MMUSERID');
        
        if (!userId) {
            const match = document.cookie.match(/MMUSERID=([^;]+)/);
            if (match) {
                userId = match[1];
                window.localStorage.setItem('MMUSERID', userId);
            }
        }
        
        if (!userId) {
            console.error('❌ [VisibilityTracker] Missing MMUSERID');
        }
        
        return userId || '';
    };

    const shouldTrackVisibility = (): boolean => {
        const currentUserId = getUserId();
        // Skip tracking if this is our own message
        return currentUserId !== postAuthorId;
    };

    const sendReadReceipt = async () => {
        if (hasSent) {
            console.log(`ℹ️ [VisibilityTracker] Already sent receipt for: ${messageId}`);
            return;
        }

        // Don't send read receipts for own messages
        if (!shouldTrackVisibility()) {
            console.log(`ℹ️ [VisibilityTracker] Skipping read receipt for author's own message:`, {
                messageId,
                postAuthorId,
                currentUserId: getUserId()
            });
            return;
        }

        const currentUserId = getUserId();
        const csrfToken = document.cookie.match(/MMCSRF=([^;]+)/)?.[1] || '';

        if (!currentUserId) {
            console.error('❌ [VisibilityTracker] Missing MMUSERID');
            return;
        }

        console.log(`📤 [VisibilityTracker] Preparing to send read receipt:`, {
            messageId,
            channelId,
            userId: currentUserId,
            hasCSRF: !!csrfToken
        });

        try {        const response = await fetch('/plugins/mattermost-readreceipts/api/v1/read', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken,
                'Mattermost-User-Id': currentUserId
            },
            credentials: 'same-origin',
            body: JSON.stringify({ 
                message_id: messageId,
                channel_id: channelId,
                timestamp: Date.now(),
                debug: {
                    timestamp: new Date().toISOString(),
                    source: 'visibility_tracker',
                    visibilityDuration: visibilityStartTime.current ? Date.now() - visibilityStartTime.current : 0
                }
            }),
            });

            if (response.ok) {
                console.log(`✅ [VisibilityTracker] Read receipt sent successfully for ${messageId}`);
                setHasSent(true);
                updateReadReceipts(messageId, currentUserId);
                onVisible?.(messageId);
            } else {
                throw new Error(`Server returned ${response.status}`);
            }
        } catch (error) {
            console.error(`❌ [VisibilityTracker] Failed to send receipt:`, {
                messageId,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    };

    const resetVisibilityTimer = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        if (visibilityStartTime.current) {
            visibilityStartTime.current = null;
        }
        console.log(`⏱️ [VisibilityTracker] Reset visibility timer for ${messageId}`);
    };

    const handleTabVisibilityChange = () => {
        if (document.visibilityState !== 'visible') {
            console.log(`👁️ [VisibilityTracker] Tab hidden, resetting timer for ${messageId}`);
            resetVisibilityTimer();
        } else {
            console.log(`👁️ [VisibilityTracker] Tab visible, will restart timer if message is visible`);
        }
    };

    const checkVisibilityDuration = () => {
        // Don't track visibility for own messages
        if (!shouldTrackVisibility()) {
            resetVisibilityTimer();
            return;
        }

        // Don't track if tab is not active
        if (document.visibilityState !== 'visible') {
            console.log(`👁️ [VisibilityTracker] Tab not active, resetting timer for ${messageId}`);
            resetVisibilityTimer();
            return;
        }

        if (visibilityStartTime.current && !hasSent) {
            const visibilityDuration = Date.now() - visibilityStartTime.current;
            if (visibilityDuration >= visibilityThresholdMs) {
                console.log(`⌛ [VisibilityTracker] Visibility threshold reached for ${messageId}:`, {
                    duration: visibilityDuration,
                    threshold: visibilityThresholdMs
                });
                sendReadReceipt();
                resetVisibilityTimer();
            }
        }
    };

    const handleVisibilityChange = debounce((entries: IntersectionObserverEntry[]) => {
        const entry = entries[0];
        const isTabActive = document.visibilityState === 'visible';
        const isNowVisible = entry.isIntersecting;
        
        console.log(`👁️ [VisibilityTracker] Visibility changed for ${messageId}:`, {
            isVisible: isNowVisible,
            visibility: Math.round(entry.intersectionRatio * 100) + '%',
            isTabActive
        });

        // Start tracking time when message becomes visible
        if (isNowVisible && isTabActive) {
            if (!visibilityStartTime.current) {
                console.log(`⏱️ [VisibilityTracker] Starting visibility timer for ${messageId}`);
                visibilityStartTime.current = Date.now();
                timerRef.current = setInterval(checkVisibilityDuration, 1000);
            }
        } else {
            console.log(`⏱️ [VisibilityTracker] Resetting visibility timer for ${messageId} (visible: ${isNowVisible}, tab active: ${isTabActive})`);
            resetVisibilityTimer();
        }
    }, 100);

    useEffect(() => {
        // Don't set up tracking for own messages
        if (!shouldTrackVisibility()) {
            console.log(`ℹ️ [VisibilityTracker] Skipping observer setup for author's message:`, {
                messageId,
                postAuthorId,
                currentUserId: getUserId()
            });
            return;
        }

        console.log(`🔄 [VisibilityTracker] Setting up observer for ${messageId}`, {
            hasExistingObserver: !!observerRef.current,
            hasElement: !!elementRef.current
        });
        
        // Set up visibility observer
        if (elementRef.current && !observerRef.current) {
            observerRef.current = new IntersectionObserver(handleVisibilityChange, {
                threshold: [0.5],
                rootMargin: '0px'
            });
            
            observerRef.current.observe(elementRef.current);
            console.log(`👀 [VisibilityTracker] Observer attached to element for ${messageId}`);
        }

        // Set up tab visibility listener
        document.addEventListener('visibilitychange', handleTabVisibilityChange);

        return () => {
            console.log(`🧹 [VisibilityTracker] Cleaning up observers for ${messageId}`);
            resetVisibilityTimer();
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
            document.removeEventListener('visibilitychange', handleTabVisibilityChange);
        };
    }, [messageId]);

    return (
        <div 
            ref={elementRef}
            style={{ width: '100%', height: '10px', opacity: 0 }}
            data-testid="visibility-tracker"
            data-message-id={messageId}
            data-channel-id={channelId}
            data-component="visibility-tracker"
        />
    );
};

export default VisibilityTracker;
