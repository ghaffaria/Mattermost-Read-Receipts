// server/model.go
package main

// ReadEvent represents a message read event in the DB.
type ReadEvent struct {
	MessageID string `json:"message_id"` // ID of the message
	UserID    string `json:"user_id"`    // ID of the user who read the message
	Timestamp int64  `json:"timestamp"`  // Unix timestamp (seconds) of when the message was read
}

// ReadRequest represents the JSON payload for the read receipt API.
type ReadRequest struct {
	MessageID string `json:"message_id"`
}

// ReadResponse represents the response payload for read receipt queries.
type ReadResponse struct {
	Events []ReadEvent `json:"events"`
}
