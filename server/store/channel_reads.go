package store

// New table-level model for per-user last read
type ChannelRead struct {
	ChannelID  string
	UserID     string
	LastPostID string
	LastSeenAt int64
}
