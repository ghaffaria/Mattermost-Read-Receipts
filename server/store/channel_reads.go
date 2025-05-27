package store

import (
	"fmt"

	"github.com/arg/mattermost-readreceipts/server/types"
)

// UpsertChannelRead updates or inserts a channel read record
func (s *MySQLStore) UpsertChannelRead(channelID, userID, lastPostID string, lastSeenAt int64) error {
	query := `
		INSERT INTO channel_reads (channel_id, user_id, last_post_id, last_seen_at)
		VALUES (?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE
		last_post_id = CASE
			WHEN last_seen_at < VALUES(last_seen_at) THEN VALUES(last_post_id)
			ELSE last_post_id
		END,
		last_seen_at = GREATEST(last_seen_at, VALUES(last_seen_at))
	`
	_, err := s.db.Exec(query, channelID, userID, lastPostID, lastSeenAt)
	if err != nil {
		return fmt.Errorf("failed to upsert channel read: %w", err)
	}
	return nil
}

// GetChannelReads gets all read receipts for a channel
func (s *MySQLStore) GetChannelReads(channelID string) ([]types.ChannelRead, error) {
	query := `
		SELECT channel_id, user_id, last_post_id, last_seen_at
		FROM channel_reads
		WHERE channel_id = ?
		ORDER BY last_seen_at DESC
	`
	rows, err := s.db.Query(query, channelID)
	if err != nil {
		return nil, fmt.Errorf("failed to query channel reads: %w", err)
	}
	defer rows.Close()

	var reads []types.ChannelRead
	for rows.Next() {
		var read types.ChannelRead
		if err := rows.Scan(&read.ChannelID, &read.UserID, &read.LastPostID, &read.LastSeenAt); err != nil {
			return nil, fmt.Errorf("failed to scan channel read: %w", err)
		}
		reads = append(reads, read)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating channel reads: %w", err)
	}
	return reads, nil
}

// Initialize creates required tables and indices for channel reads
func (s *MySQLStore) InitializeChannelReads() error {
	// Create channel_reads table if it doesn't exist
	createTable := `
	CREATE TABLE IF NOT EXISTS channel_reads (
		channel_id VARCHAR(255) NOT NULL,
		user_id VARCHAR(255) NOT NULL,
		last_post_id VARCHAR(255) NOT NULL,
		last_seen_at BIGINT NOT NULL,
		PRIMARY KEY (channel_id, user_id),
		INDEX idx_channel_reads_channel_id (channel_id),
		INDEX idx_channel_reads_user_id (user_id),
		INDEX idx_channel_reads_last_seen (last_seen_at)
	)
	`
	if _, err := s.db.Exec(createTable); err != nil {
		return fmt.Errorf("failed to create channel_reads table: %w", err)
	}
	return nil
}
