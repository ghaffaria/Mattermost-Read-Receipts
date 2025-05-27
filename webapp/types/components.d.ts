// webapp/types/components.d.ts

export interface VisibilityTrackerProps {
    /**
     * The ID of the message to track visibility for
     */
    messageId: string;

    /**
     * The ID of the channel containing the message
     */
    channelId: string;

    /**
     * Callback function to be called when the message becomes visible
     */
    onVisible: () => void;

    /**
     * The ID of the user who authored the post (optional)
     */
    postAuthorId?: string;
}
