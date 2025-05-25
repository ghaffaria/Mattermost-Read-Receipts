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
            console.error('❌ [VisibilityTracker] Missing MMUSERID in both localStorage and cookies');
        } else {
            console.log('✅ [VisibilityTracker] Found userId:', userId);
        }
        
        return userId || '';
    };

    const isOwnMessage = (msgId: string): boolean => {
        const currentUserId = getUserId();
        // Message IDs are in format userId:timestamp
        const messageUserId = msgId.split(':')[0];
        return currentUserId === messageUserId;
    };

    const sendReadReceipt = async () => {
        if (hasSent) {
            console.log(`ℹ️ [VisibilityTracker] Already sent receipt for: ${messageId}`);
            return;
        }

        // Don't send read receipts for own messages
        if (isOwnMessage(messageId)) {
            console.log(`ℹ️ [VisibilityTracker] Skipping read receipt for own message: ${messageId}`);
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
            userId: currentUserId,
            hasCSRF: !!csrfToken,
            cookieUserId: document.cookie.match(/MMUSERID=([^;]+)/)?.[1],
            localStorageUserId: window.localStorage.getItem('MMUSERID'),
            visibilityDuration: visibilityStartTime.current ? Date.now() - visibilityStartTime.current : 0
        });

        try {
            const response = await fetch('/plugins/mattermost-readreceipts/api/v1/read', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken,
                    'Mattermost-User-Id': currentUserId
                },
                credentials: 'same-origin',
                body: JSON.stringify({ 
                    message_id: messageId,
                    debug: {
                        timestamp: new Date().toISOString(),
                        source: 'visibility_tracker',
                        visibilityDuration: visibilityStartTime.current ? Date.now() - visibilityStartTime.current : 0
                    }
                }),
            });

            console.log(`📨 [VisibilityTracker] Server response:`, {
                status: response.status,
                ok: response.ok,
                text: await response.text(),
                requestHeaders: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken ? '(present)' : '(missing)',
                    'Mattermost-User-Id': currentUserId
                }
            });

            if (response.ok) {
                console.log(`✅ [VisibilityTracker] Read receipt sent successfully for ${messageId}`);
                setHasSent(true);
            } else {
                throw new Error(`Server returned ${response.status}`);
            }
        } catch (error) {
            console.error(`❌ [VisibilityTracker] Failed to send receipt:`, {
                messageId,
                error: error instanceof Error ? error.message : String(error),
                requestUrl: '/plugins/mattermost-readreceipts/api/v1/read',
                userId: currentUserId,
                csrfToken: csrfToken ? '(present)' : '(missing)',
                cookieInfo: document.cookie ? {
                    hasMmUserId: !!document.cookie.match(/MMUSERID=/),
                    hasCsrf: !!document.cookie.match(/MMCSRF=/),
                    allCookies: document.cookie.split(';').map(c => c.trim().split('=')[0])
                } : '(no cookies)'
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
        if (isOwnMessage(messageId)) {
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
            if (visibilityDuration >= 2000) {
                console.log(`⌛ [VisibilityTracker] Visibility threshold reached for ${messageId}:`, {
                    duration: visibilityDuration,
                    threshold: 2000
                });
                sendReadReceipt();
                resetVisibilityTimer();
            }
        }
    };

    const handleVisibilityChange = debounce((entries: IntersectionObserverEntry[]) => {
        const entry = entries[0];
        const isNowVisible = entry.isIntersecting && entry.intersectionRatio >= 0.5;
        const isTabActive = document.visibilityState === 'visible';
        
        console.log(`👁️ [VisibilityTracker] Visibility changed:`, {
            messageId,
            isIntersecting: entry.isIntersecting,
            ratio: entry.intersectionRatio,
            isVisible: isNowVisible,
            isTabActive,
            hasSent,
            visibilityStartTime: visibilityStartTime.current,
            userId: getUserId()
        });

        // Only start timer if both message and tab are visible
        if (isNowVisible && isTabActive && !visibilityStartTime.current && !hasSent) {
            console.log(`⏳ [VisibilityTracker] Starting visibility timer for ${messageId}`);
            visibilityStartTime.current = Date.now();
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
            timerRef.current = setInterval(checkVisibilityDuration, 100);
        } else if (!isNowVisible || !isTabActive) {
            console.log(`⏱️ [VisibilityTracker] Resetting visibility timer for ${messageId} (visible: ${isNowVisible}, tab active: ${isTabActive})`);
            resetVisibilityTimer();
        }
    }, 100);

    useEffect(() => {
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
            data-component="visibility-tracker"
        />
    );
};

export default VisibilityTracker;
