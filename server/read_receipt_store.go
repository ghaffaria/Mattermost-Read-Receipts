package main

import (
	"time"

	"github.com/arg/mattermost-readreceipts/server/store"
)

// ReadReceiptStore wraps the generated SQL store and adds an idempotent helper.
type ReadReceiptStore struct {
	Store store.ReceiptStore
}

// MarkPostAsRead inserts or updates the read receipt.
func (s *ReadReceiptStore) MarkPostAsRead(postID, userID string) error {
	event := store.ReadEvent{
		MessageID: postID,
		UserID:    userID,
		Timestamp: time.Now().UnixMilli(),
	}
	return s.Store.Upsert(event)
}
