// server/api.go

package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/plugin"
)

func (p *Plugin) ServeHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
	router := mux.NewRouter()

	// Existing routes
	router.Handle("/api/v1/read", p.MattermostAuthorizationRequired(http.HandlerFunc(p.HandleReadReceipt))).Methods("POST")
	router.Handle("/api/v1/receipts", p.MattermostAuthorizationRequired(http.HandlerFunc(p.HandleGetReceipts))).Methods("GET")

	// Debug routes
	router.Handle("/api/v1/debug/ping", http.HandlerFunc(p.HandlePing)).Methods("GET")
	router.Handle("/api/v1/debug/db", p.MattermostAuthorizationRequired(http.HandlerFunc(p.HandleDBCheck))).Methods("GET")

	// Log all incoming requests
	p.API.LogDebug("[API] Received request",
		"path", r.URL.Path,
		"method", r.Method,
		"user_agent", r.UserAgent(),
		"content_type", r.Header.Get("Content-Type"),
		"has_csrf", r.Header.Get("X-CSRF-Token") != "",
		"has_user_id", r.Header.Get("Mattermost-User-Id") != "",
	)

	router.ServeHTTP(w, r)
}

func (p *Plugin) MattermostAuthorizationRequired(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID := r.Header.Get("Mattermost-User-Id")
		if userID == "" {
			userID = r.Header.Get("Mattermost-User-ID")
		}
		if userID == "" {
			p.API.LogError("[API] Unauthorized request", "path", r.URL.Path, "method", r.Method)
			http.Error(w, "Not authorized", http.StatusUnauthorized)
			return
		}

		// Add the user ID to the request context
		r = r.WithContext(r.Context())
		next.ServeHTTP(w, r)
	})
}

func (p *Plugin) HandlePing(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status": "ok",
		"time":   time.Now().String(),
	})
}

func (p *Plugin) HandleDBCheck(w http.ResponseWriter, r *http.Request) {
	// Test database connection
	if err := p.DB.Ping(); err != nil {
		p.API.LogError("[DB] Database ping failed", "error", err.Error())
		http.Error(w, "Database connection error", http.StatusInternalServerError)
		return
	}

	// Test schema exists
	var count int
	err := p.DB.QueryRow("SELECT COUNT(*) FROM read_events").Scan(&count)
	if err != nil {
		p.API.LogError("[DB] Schema check failed", "error", err.Error())
		http.Error(w, "Database schema error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":           "ok",
		"read_events_rows": count,
		"time":             time.Now().String(),
	})
}

func (p *Plugin) HandleReadReceipt(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-Id")
	if userID == "" {
		userID = r.Header.Get("Mattermost-User-ID")
	}

	// Enhanced request logging
	p.API.LogDebug("[API] Processing read receipt request",
		"user_id", userID,
		"content_type", r.Header.Get("Content-Type"),
		"content_length", r.ContentLength,
		"csrf_token", r.Header.Get("X-CSRF-Token") != "",
	)

	var req ReadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		p.API.LogError("[API] Failed to decode request body",
			"error", err.Error(),
			"content_type", r.Header.Get("Content-Type"),
		)
		http.Error(w, "Invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}

	if req.MessageID == "" {
		p.API.LogError("[API] Missing message_id in request")
		http.Error(w, "Missing message_id", http.StatusBadRequest)
		return
	}

	// Fetch post to get channel ID
	post, err := p.API.GetPost(req.MessageID)
	if err != nil {
		p.API.LogError("[API] Failed to fetch post",
			"message_id", req.MessageID,
			"error", err.Error())
		http.Error(w, "Failed to fetch post details", http.StatusInternalServerError)
		return
	}

	p.API.LogInfo("[API] Storing read receipt",
		"message_id", req.MessageID,
		"user_id", userID,
		"channel_id", post.ChannelId)

	readEvent := ReadEvent{
		MessageID: req.MessageID,
		UserID:    userID,
		Timestamp: time.Now().Unix(),
	}

	if err := p.storeReadEvent(readEvent); err != nil {
		p.API.LogError("[API] Failed to store read event",
			"message_id", readEvent.MessageID,
			"user_id", readEvent.UserID,
			"error", err.Error())
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	p.API.LogInfo("[API] Read receipt stored successfully",
		"message_id", readEvent.MessageID,
		"user_id", readEvent.UserID,
		"channel_id", post.ChannelId)

	// Broadcast WebSocket event only to users in the channel
	p.API.PublishWebSocketEvent(
		"custom_mattermost-readreceipts_read_receipt",
		map[string]interface{}{
			"message_id": readEvent.MessageID,
			"user_id":    readEvent.UserID,
			"timestamp":  readEvent.Timestamp,
		},
		&model.WebsocketBroadcast{
			ChannelId: post.ChannelId,
		},
	)

	p.API.LogDebug("[API] WebSocket event published",
		"message_id", readEvent.MessageID,
		"user_id", readEvent.UserID,
		"channel_id", post.ChannelId)

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
	// Input validation
	if event.MessageID == "" || event.UserID == "" || event.Timestamp <= 0 {
		return fmt.Errorf("invalid read event: missing required fields or invalid timestamp")
	}

	// Start transaction for consistency
	tx, err := p.DB.Begin()
	if err != nil {
		p.API.LogError("[DB] Failed to start transaction",
			"message_id", event.MessageID,
			"user_id", event.UserID,
			"error", err.Error())
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback() // Will be no-op if transaction is committed

	// Check if there's a more recent receipt already
	var existingTimestamp int64
	err = tx.QueryRow(
		"SELECT timestamp FROM read_events WHERE message_id = $1 AND user_id = $2",
		event.MessageID, event.UserID,
	).Scan(&existingTimestamp)

	if err == nil {
		if existingTimestamp >= event.Timestamp {
			// A more recent (or same) receipt already exists
			p.API.LogDebug("[DB] Skipping older receipt",
				"message_id", event.MessageID,
				"user_id", event.UserID,
				"existing_timestamp", existingTimestamp,
				"new_timestamp", event.Timestamp)
			return nil
		}
	} else if err != sql.ErrNoRows {
		// Unexpected error checking existing receipt
		p.API.LogError("[DB] Error checking existing receipt",
			"message_id", event.MessageID,
			"user_id", event.UserID,
			"error", err.Error())
		return fmt.Errorf("error checking existing receipt: %w", err)
	}

	// Insert or update with new timestamp
	query := `
        INSERT INTO read_events (message_id, user_id, timestamp) 
        VALUES ($1, $2, $3) 
        ON CONFLICT (message_id, user_id) 
        DO UPDATE SET timestamp = EXCLUDED.timestamp
        WHERE read_events.timestamp < EXCLUDED.timestamp
    `

	p.API.LogDebug("[DB] Storing read receipt",
		"message_id", event.MessageID,
		"user_id", event.UserID,
		"timestamp", event.Timestamp)

	result, err := tx.Exec(query, event.MessageID, event.UserID, event.Timestamp)
	if err != nil {
		p.API.LogError("[DB] Failed to store read receipt",
			"message_id", event.MessageID,
			"user_id", event.UserID,
			"error", err.Error())
		return fmt.Errorf("failed to store read receipt: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		p.API.LogError("[DB] Failed to get rows affected",
			"message_id", event.MessageID,
			"user_id", event.UserID,
			"error", err.Error())
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	// Commit the transaction
	if err := tx.Commit(); err != nil {
		p.API.LogError("[DB] Failed to commit transaction",
			"message_id", event.MessageID,
			"user_id", event.UserID,
			"error", err.Error())
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	if rowsAffected > 0 {
		p.API.LogDebug("[DB] Read receipt stored",
			"message_id", event.MessageID,
			"user_id", event.UserID,
			"timestamp", event.Timestamp,
			"rows_affected", rowsAffected)
	} else {
		p.API.LogDebug("[DB] No update needed (newer receipt exists)",
			"message_id", event.MessageID,
			"user_id", event.UserID,
			"timestamp", event.Timestamp)
	}

	return nil
}
