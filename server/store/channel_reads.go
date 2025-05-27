package store

// New table-level model for per-user last read
type ChannelRead struct {
	ChannelID  string `json:"channel_id"`
	UserID     string `json:"user_id"`
	LastPostID string `json:"last_post_id"`
	LastSeenAt int64  `json:"last_seen_at"`
}
