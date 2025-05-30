import React from 'react';
import { connect } from 'react-redux';

function ReadReceiptIndicator({ post, currentUserId, readers, userProfiles }) {
    // If no other user has read this post, show nothing
    if (!readers || readers.length === 0) {
        return null;
    }

    // Filter out the current user from readers
    const otherReaders = readers.filter(userId => userId !== currentUserId);
    
    // If no other users have read this post, show nothing
    if (otherReaders.length === 0) {
        return null;
    }

    // Get display names for readers
    const readerNames = otherReaders.map(userId => {
        const profile = userProfiles[userId];
        return profile ? (profile.display_name || profile.username) : 'Unknown User';
    });

    // Create readable text
    let readText = '';
    if (readerNames.length === 1) {
        readText = `Seen by ${readerNames[0]}`;
    } else if (readerNames.length === 2) {
        readText = `Seen by ${readerNames[0]} and ${readerNames[1]}`;
    } else {
        readText = `Seen by ${readerNames[0]} and ${readerNames.length - 1} other${readerNames.length > 2 ? 's' : ''}`;
    }

    return (
        <div className="read-receipt-indicator" style={{
            fontSize: '11px',
            color: '#888',
            marginTop: '2px',
            fontStyle: 'italic'
        }}>
            {readText}
        </div>
    );
}

const mapStateToProps = (state, ownProps) => {
    const readers = state.readReceipts?.postReadReceipts?.[ownProps.post.id] || [];
    const userProfiles = state.entities?.users?.profiles || {};
    const currentUserId = state.entities?.users?.currentUserId;

    return {
        readers,
        userProfiles,
        currentUserId
    };
};

export default connect(mapStateToProps)(ReadReceiptIndicator);
