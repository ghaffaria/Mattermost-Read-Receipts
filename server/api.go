// server/api.go

package main

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/arg/mattermost-readreceipts/server/types"
	"github.com/mattermost/mattermost-server/v6/model"
)

// Add storeReadEvent method to ReadReceiptPlugin
func (p *ReadReceiptPlugin) storeReadEvent(_ types.ReadEvent) error {
	// Logic to store the event in the database
	return nil
}

// HandleReadReceipt handles the POST /api/v1/read route.
func (p *ReadReceiptPlugin) HandleReadReceipt(w http.ResponseWriter, r *http.Request) {
    if enableLogging {
        p.API.LogInfo("Received read receipt request")
    }

    var req types.ReadRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "Invalid request body", http.StatusBadRequest)
        return
    }

    userID := r.Header.Get("Mattermost-User-ID")
    if userID == "" {
        http.Error(w, "Unauthorized", http.StatusUnauthorized)
        return
    }

    timestamp := time.Now().Unix()
    readEvent := types.ReadEvent{
        MessageID: req.MessageID,
        UserID:    userID,
        Timestamp: timestamp,
    }

    if err := p.storeReadEvent(readEvent); err != nil {
        http.Error(w, "Internal server error", http.StatusInternalServerError)
        return
    }

    eventData := map[string]interface{}{
        "post_id":   readEvent.MessageID,
        "user_id":   readEvent.UserID,
        "timestamp": readEvent.Timestamp,
    }

    p.API.PublishWebSocketEvent(
        "custom_mattermost-readreceipts_read_receipt",
        eventData,
        &model.WebsocketBroadcast{
            OmitUsers: map[string]bool{readEvent.UserID: true},
        },
    )

    w.WriteHeader(http.StatusOK)
}
