package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/arg/mattermost-readreceipts/server/store"
	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/plugin"
)

// Using model.ReadRequest and model.ReadEvent defined in model.go

func (p *Plugin) ServeHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
	router := mux.NewRouter()

	router.Handle("/api/v1/read", p.MattermostAuthorizationRequired(http.HandlerFunc(p.HandleReadReceipt))).Methods("POST")
	router.Handle("/api/v1/channel/{channelID}/readers", p.MattermostAuthorizationRequired(http.HandlerFunc(p.HandleGetChannelReaders))).Methods("GET")
	router.Handle("/api/v1/receipts", p.MattermostAuthorizationRequired(http.HandlerFunc(p.HandleGetReceipts))).Methods("GET")
	router.Handle("/api/v1/config", p.MattermostAuthorizationRequired(http.HandlerFunc(p.HandleGetConfig))).Methods("GET")
	router.Handle("/api/v1/debug/ping", http.HandlerFunc(p.HandlePing)).Methods("GET")
	router.Handle("/api/v1/debug/db", p.MattermostAuthorizationRequired(http.HandlerFunc(p.HandleDBCheck))).Methods("GET")
	router.Handle("/api/v1/read/channel/{channelID}", p.MattermostAuthorizationRequired(http.HandlerFunc(p.HandleGetReadersSince))).Methods("GET")

	p.logDebug("[API] Received request",
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
			p.logError("[API] Unauthorized request", "path", r.URL.Path, "method", r.Method)
			http.Error(w, "Not authorized", http.StatusUnauthorized)
			return
		}

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
	if p.store == nil {
		p.logError("[DB] Store not initialized")
		http.Error(w, "Database not initialized", http.StatusInternalServerError)
		return
	}

	_, err := p.store.GetByChannel("test", "test")
	if err != nil {
		p.logError("[DB] Database check failed", "error", err.Error())
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "ok",
		"time":   time.Now().String(),
	})
}

func (p *Plugin) HandleReadReceipt(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-Id")
	if userID == "" {
		userID = r.Header.Get("Mattermost-User-ID")
	}

	p.logDebug("[API] Processing read receipt request",
		"user_id", userID,
		"content_type", r.Header.Get("Content-Type"),
		"content_length", r.ContentLength,
		"csrf_token", r.Header.Get("X-CSRF-Token") != "",
	)

	var req ReadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		p.logError("[API] Failed to decode request body",
			"error", err.Error(),
			"content_type", r.Header.Get("Content-Type"),
		)
		http.Error(w, "Invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}

	if req.MessageID == "" {
		p.logError("[API] Missing message_id in request")
		http.Error(w, "Missing message_id", http.StatusBadRequest)
		return
	}

	var channelId string
	post, err := p.API.GetPost(req.MessageID)
	if err == nil {
		channelId = post.ChannelId
		p.logInfo("[API] Processing read receipt",
			"message_id", req.MessageID,
			"user_id", userID,
			"channel_id", channelId)

		// Update channel-level read receipt
		if err := p.store.UpsertChannelRead(channelId, userID, post.Id, post.CreateAt); err != nil {
			p.logError("[API] Failed to upsert channel read",
				"channel_id", channelId,
				"user_id", userID,
				"post_id", post.Id,
				"error", err.Error())
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
	} else {
		p.logInfo("[API] GetPost failed, will broadcast globally",
			"message_id", req.MessageID,
			"error", err.Error())
	}

	readEvent := ReadEvent{
		MessageID: req.MessageID,
		UserID:    userID,
		Timestamp: time.Now().Unix(),
	}

	if err := p.storeReadEvent(readEvent); err != nil {
		p.logError("[API] Failed to store read event",
			"message_id", readEvent.MessageID,
			"user_id", readEvent.UserID,
			"error", err.Error())
		w.WriteHeader(http.StatusNoContent)
		return
	}

	logFields := []interface{}{
		"message_id", readEvent.MessageID,
		"user_id", readEvent.UserID,
	}
	if channelId != "" {
		logFields = append(logFields, "channel_id", channelId)
	}
	p.logInfo("[API] Read receipt stored successfully", logFields...)

	broadcast := &model.WebsocketBroadcast{}
	if channelId != "" {
		broadcast.ChannelId = channelId
	}

	p.API.PublishWebSocketEvent(
		"custom_mattermost-readreceipts_read_receipt",
		map[string]interface{}{
			"message_id": readEvent.MessageID,
			"user_id":    readEvent.UserID,
			"timestamp":  readEvent.Timestamp,
		},
		broadcast,
	)

	broadcastType := "global"
	if channelId != "" {
		broadcastType = "channel"
	}
	p.logDebug("[API] Read receipt broadcast",
		"message_id", readEvent.MessageID,
		"user_id", readEvent.UserID,
		"channel_id", channelId,
		"broadcast_type", broadcastType)

	w.WriteHeader(http.StatusNoContent)
}

func (p *Plugin) HandleGetReceipts(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-Id")
	if userID == "" {
		userID = r.Header.Get("Mattermost-User-ID")
	}

	channelID := r.URL.Query().Get("channel_id")
	if channelID == "" {
		p.logError("[API] Missing channel_id parameter")
		http.Error(w, "Missing channel_id parameter", http.StatusBadRequest)
		return
	}

	p.logDebug("[API] Fetching channel receipts",
		"channel_id", channelID,
		"user_id", userID)

	sinceMs, err := p.getSinceMillis(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Get list of users who have read messages in this channel since the given time
	readers, err := p.store.GetReadersSince(channelID, sinceMs, userID)
	if err != nil {
		p.logError("[API] Failed to fetch channel readers",
			"channel_id", channelID,
			"since", sinceMs,
			"error", err.Error())
		http.Error(w, "Failed to fetch channel readers", http.StatusInternalServerError)
		return
	}

	p.logDebug("[API] Returning channel readers",
		"channel_id", channelID,
		"reader_count", len(readers))

	response := struct {
		UserIDs []string `json:"user_ids"`
	}{
		UserIDs: readers,
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		p.logError("[API] Error encoding response",
			"channel_id", channelID,
			"error", err.Error())
		http.Error(w, "Error encoding response", http.StatusInternalServerError)
		return
	}
}

func (p *Plugin) HandleGetConfig(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	conf := p.getConfiguration()
	cfg := map[string]interface{}{
		"visibility_threshold_ms": conf.VisibilityThresholdMs,
		"retention_days":          conf.RetentionDays,
		"log_level":               conf.LogLevel,
	}

	if err := json.NewEncoder(w).Encode(cfg); err != nil {
		p.logError("[API] Error encoding config response", "error", err.Error())
		http.Error(w, "Error encoding response", http.StatusInternalServerError)
	}
}

func (p *Plugin) HandleGetReadersSince(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	channelID := vars["channelID"]
	if channelID == "" {
		http.Error(w, "Missing channel ID", http.StatusBadRequest)
		return
	}

	userID := r.Header.Get("Mattermost-User-Id")
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	sinceMs, err := p.getSinceMillis(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	readers, err := p.store.GetReadersSince(channelID, sinceMs, userID)
	if err != nil {
		p.logError("[API] Failed to get readers since",
			"channel_id", channelID,
			"since", sinceMs,
			"error", err.Error())
		http.Error(w, "Failed to get readers", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(readers); err != nil {
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
	}
}

// HandleGetChannelReaders handles GET /api/v1/channel/{channelID}/readers
func (p *Plugin) HandleGetChannelReaders(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	channelID := vars["channelID"]
	if channelID == "" {
		http.Error(w, "Missing channel ID", http.StatusBadRequest)
		return
	}

	userID := r.Header.Get("Mattermost-User-Id")
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	sinceMs, err := p.getSinceMillis(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	readers, err := p.store.GetReadersSince(channelID, sinceMs, userID)
	if err != nil {
		p.logError("[API] Failed to get channel readers",
			"channel_id", channelID,
			"since", sinceMs,
			"error", err.Error())
		http.Error(w, "Failed to get readers", http.StatusInternalServerError)
		return
	}

	response := struct {
		UserIDs []string `json:"user_ids"`
	}{
		UserIDs: readers,
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		return
	}
}

// Helper function to resolve timestamp in milliseconds since epoch
func (p *Plugin) getSinceMillis(r *http.Request) (int64, error) {
	query := r.URL.Query()
	sinceStr := query.Get("since")
	if sinceStr != "" {
		sinceMs, err := strconv.ParseInt(sinceStr, 10, 64)
		if err != nil {
			return 0, fmt.Errorf("invalid since parameter")
		}
		return sinceMs, nil
	}

	postID := query.Get("postID")
	if postID != "" {
		post, err := p.API.GetPost(postID)
		if err != nil {
			return 0, fmt.Errorf("invalid post ID: %w", err)
		}
		// Post.CreateAt is already in milliseconds since epoch
		return post.CreateAt, nil
	}

	return 0, fmt.Errorf("missing since or postID")
}

func (p *Plugin) storeReadEvent(event ReadEvent) error {
	if event.MessageID == "" || event.UserID == "" || event.Timestamp <= 0 {
		return fmt.Errorf("invalid read event: missing required fields or invalid timestamp")
	}

	storeEvent := store.ReadEvent{
		MessageID: event.MessageID,
		UserID:    event.UserID,
		Timestamp: event.Timestamp,
	}

	if err := p.store.Upsert(storeEvent); err != nil {
		p.logError("[Store] Failed to store read event",
			"message_id", event.MessageID,
			"user_id", event.UserID,
			"error", err.Error())
		return fmt.Errorf("failed to store read event: %w", err)
	}

	return nil
}
