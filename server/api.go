// server/api.go

package main

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/plugin"
)

func (p *Plugin) ServeHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
	router := mux.NewRouter()

	// Middleware احراز هویت
	router.Use(p.MattermostAuthorizationRequired)

	apiRouter := router.PathPrefix("/api/v1").Subrouter()
	apiRouter.HandleFunc("/read", p.HandleReadReceipt).Methods("POST")
	apiRouter.HandleFunc("/receipts", p.HandleGetReceipts).Methods("GET")

	router.ServeHTTP(w, r)
}

func (p *Plugin) MattermostAuthorizationRequired(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID := r.Header.Get("Mattermost-User-Id")
		if userID == "" {
			userID = r.Header.Get("Mattermost-User-ID")
		}

		if userID == "" {
			p.API.LogError("Authorization failed: Missing Mattermost-User-Id header")
			http.Error(w, "Not authorized", http.StatusUnauthorized)
			return
		}

		p.API.LogInfo("Authorization successful", "userID", userID)
		next.ServeHTTP(w, r)
	})
}

func (p *Plugin) HandleReadReceipt(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-Id")
	if userID == "" {
		userID = r.Header.Get("Mattermost-User-ID")
	}
	if userID == "" {
		http.Error(w, "Not authorized", http.StatusUnauthorized)
		return
	}
	var req ReadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		p.API.LogError("Failed to decode request body", "error", err.Error())
		http.Error(w, "Invalid request body: unable to parse JSON", http.StatusBadRequest)
		return
	}

	p.API.LogInfo("[API] HandleReadReceipt called, user:", userID, "messageID:", req.MessageID)

	readEvent := ReadEvent{
		MessageID: req.MessageID,
		UserID:    userID,
		Timestamp: time.Now().Unix(),
	}
	if err := p.storeReadEvent(readEvent); err != nil {
		p.API.LogError("Failed to store read event", "message_id", readEvent.MessageID, "user_id", readEvent.UserID, "error", err.Error())
		http.Error(w, "Internal server error: unable to store read event", http.StatusInternalServerError)
		return
	}

	// Publish WebSocket event
	p.API.LogInfo("Publishing WebSocket event", "message_id", readEvent.MessageID, "user_id", readEvent.UserID)
	p.API.PublishWebSocketEvent(
		"custom_mattermost-readreceipts_read_receipt",
		map[string]interface{}{
			"message_id": readEvent.MessageID,
			"user_id":    readEvent.UserID,
		},
		&model.WebsocketBroadcast{
			OmitUsers: nil, // Broadcast to all users
		},
	)

	p.API.LogInfo("[API] WebSocket event published", "eventData", map[string]interface{}{"message_id": readEvent.MessageID, "user_id": readEvent.UserID})

	w.WriteHeader(http.StatusNoContent)
}

func (p *Plugin) HandleGetReceipts(w http.ResponseWriter, r *http.Request) {
	messageID := r.URL.Query().Get("message_id")
	if messageID == "" {
		http.Error(w, "Missing message_id parameter", http.StatusBadRequest)
		return
	}

	p.API.LogInfo("Fetching read receipts for message", "message_id", messageID)

	query := `
        SELECT user_id FROM read_events WHERE message_id = $1
    `

	rows, err := p.DB.Query(query, messageID)
	if err != nil {
		p.API.LogError("Database query failed", "query", query, "message_id", messageID, "error", err.Error())
		http.Error(w, "Internal server error: database query failed", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var userIDs []string
	for rows.Next() {
		var userID string
		if err := rows.Scan(&userID); err != nil {
			p.API.LogError("Failed to scan row", "error", err.Error())
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		userIDs = append(userIDs, userID)
	}

	if err := rows.Err(); err != nil {
		p.API.LogError("Error iterating rows", "error", err.Error())
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	p.API.LogInfo("Read receipts fetched successfully", "message_id", messageID, "seen_by", userIDs)

	response := map[string]interface{}{
		"message_id": messageID,
		"seen_by":    userIDs,
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		p.API.LogError("Failed to encode response", "error", err.Error())
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
}

func (p *Plugin) storeReadEvent(event ReadEvent) error {
	query := `
    INSERT INTO read_events (message_id, user_id, timestamp)
    VALUES ($1, $2, $3)
    ON CONFLICT (message_id, user_id) DO NOTHING;
    `

	_, err := p.DB.Exec(query, event.MessageID, event.UserID, event.Timestamp)
	if err != nil {
		p.API.LogError("Failed to store read event", "error", err.Error())
		return err
	}

	p.API.LogInfo("Read event stored successfully", "message_id", event.MessageID, "user_id", event.UserID)
	return nil
}
