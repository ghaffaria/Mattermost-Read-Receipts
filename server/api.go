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

	p.API.LogInfo("[API] Storing read receipt", "message_id", req.MessageID, "user_id", userID)

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
		"user_id", readEvent.UserID)

	// Broadcast WebSocket event
	p.API.PublishWebSocketEvent(
		"custom_mattermost-readreceipts_read_receipt",
		map[string]interface{}{
			"message_id": readEvent.MessageID,
			"user_id":    readEvent.UserID,
			"timestamp":  readEvent.Timestamp,
		},
		&model.WebsocketBroadcast{},
	)

	p.API.LogDebug("[API] WebSocket event published",
		"message_id", readEvent.MessageID,
		"user_id", readEvent.UserID)

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
		ON CONFLICT (message_id, user_id) 
		DO UPDATE SET timestamp = EXCLUDED.timestamp;
	`

	p.API.LogDebug("[DB] Executing query",
		"message_id", event.MessageID,
		"user_id", event.UserID)

	result, err := p.DB.Exec(query, event.MessageID, event.UserID, event.Timestamp)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		p.API.LogError("[DB] Failed to get rows affected", "error", err.Error())
		return err
	}

	p.API.LogDebug("[DB] Query executed successfully",
		"rows_affected", rowsAffected,
		"message_id", event.MessageID,
		"user_id", event.UserID)

	return nil
}
