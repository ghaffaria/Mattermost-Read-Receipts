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

	// Decode the JSON payload.
	var req types.ReadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		if enableLogging {
			p.API.LogError("Failed to decode request body", "error", err.Error())
		}
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Fetch the user ID from the request context.
	userID := r.Header.Get("Mattermost-User-ID")
	if userID == "" {
		if enableLogging {
			p.API.LogError("User ID not found in request context")
		}
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Store the read event in the database.
	timestamp := time.Now().Unix()
	readEvent := types.ReadEvent{
		MessageID: req.MessageID,
		UserID:    userID,
		Timestamp: timestamp,
	}
	if err := p.storeReadEvent(readEvent); err != nil {
		if enableLogging {
			p.API.LogError("Failed to store read event", "error", err.Error())
		}
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if enableLogging {
		p.API.LogInfo("Read event stored successfully", "message_id", req.MessageID, "user_id", userID)
	}

	// Broadcast the read receipt via WebSocket.
	payload := map[string]interface{}{
		"message_id": req.MessageID,
		"user_id":    userID,
		"timestamp":  timestamp,
	}
	p.API.PublishWebSocketEvent("read_receipt", payload, &model.WebsocketBroadcast{})

	if enableLogging {
		p.API.LogInfo("WebSocket event broadcasted", "payload", payload)
	}

	w.WriteHeader(http.StatusOK)
}
