package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/arg/mattermost-readreceipts/server/store"
	"github.com/arg/mattermost-readreceipts/server/types"
	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-server/v6/plugin"
)

// Using model.ReadRequest and model.ReadEvent defined in model.go

func (p *Plugin) ServeHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
	router := mux.NewRouter()

	router.Handle("/api/v1/read", p.MattermostAuthorizationRequired(http.HandlerFunc(p.HandleReadReceipt))).Methods("POST")
	router.Handle("/api/v1/channel/{channelID}/readers", p.MattermostAuthorizationRequired(http.HandlerFunc(p.HandleGetChannelReaders))).Methods("GET")
	router.Handle("/api/v1/channel/{channelID}/reads", p.MattermostAuthorizationRequired(http.HandlerFunc(p.HandleGetChannelReads))).Methods("GET")
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

	decoder := json.NewDecoder(r.Body)
	var req ReadRequest
	if err := decoder.Decode(&req); err != nil {
		p.logError("[API] Failed to decode request body", "error", err.Error(), "body", r.Body)
		http.Error(w, "Invalid request format", http.StatusBadRequest)
		return
	}

	// Debug log the received request
	p.logDebug("[API] Received read receipt request",
		"message_id", req.MessageID,
		"channel_id", req.ChannelID,
		"user_id", userID)

	// Validate message_id
	if req.MessageID == "" {
		p.logError("[API] Missing message_id in request")
		http.Error(w, "message_id is required", http.StatusBadRequest)
		return
	}

	// Get post to verify channel_id if not provided
	post, err := p.API.GetPost(req.MessageID)
	if err != nil {
		p.logError("[API] Failed to get post",
			"message_id", req.MessageID,
			"error", err.Error(),
			"user_id", userID)
		http.Error(w, "Invalid message_id", http.StatusBadRequest)
		return
	}

	channelID := req.ChannelID
	if channelID == "" {
		channelID = post.ChannelId
		p.logDebug("[API] Using channel_id from post",
			"channel_id", channelID,
			"message_id", req.MessageID)
	}

	// Get channel info for enhanced debugging
	channel, channelErr := p.API.GetChannel(channelID)
	if channelErr != nil {
		p.logError("[API] CRITICAL - Failed to get channel info", "channelID", channelID, "error", channelErr.Error())
	} else {
		p.logError("[API] CRITICAL - Channel details", "channelID", channelID, "channelType", channel.Type, "channelName", channel.Name, "teamID", channel.TeamId, "isDM", channel.Type == "D")

		// For DM channels, get the members
		if channel.Type == "D" {
			members, membersErr := p.API.GetChannelMembers(channelID, 0, 10)
			if membersErr != nil {
				p.logError("[API] CRITICAL - Failed to get DM channel members", "channelID", channelID, "error", membersErr.Error())
			} else {
				memberIDs := make([]string, len(members))
				for i, member := range members {
					memberIDs[i] = member.UserId
				}
				p.logError("[API] CRITICAL - DM channel members", "channelID", channelID, "memberCount", len(members), "memberIDs", memberIDs, "readerUserID", userID)
			}
		}
	}

	// Store the read receipt
	now := time.Now().UnixMilli() // Use milliseconds instead of seconds
	event := store.ReadEvent{
		MessageID: req.MessageID,
		UserID:    userID,
		ChannelID: channelID,
		Timestamp: now,
	}

	// Begin transaction
	tx, txErr := p.store.BeginTx()
	if txErr != nil {
		p.logError("[API] Failed to begin transaction", "error", txErr.Error())
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// Store read receipt
	if err := p.store.UpsertTx(tx, event); err != nil {
		p.logError("[API] Failed to store read receipt",
			"message_id", req.MessageID,
			"user_id", userID,
			"channel_id", channelID,
			"error", err.Error(),
		)
		http.Error(w, "Failed to store read receipt", http.StatusInternalServerError)
		return
	}

	// Update channel read status
	channelRead := types.ChannelRead{
		ChannelID:  channelID,
		UserID:     userID,
		LastPostID: req.MessageID,
		LastSeenAt: now,
	}
	if err := p.store.UpsertChannelReadTx(tx, channelRead); err != nil {
		p.logError("[API] Failed to update channel read",
			"channel_id", channelID,
			"user_id", userID,
			"error", err.Error(),
		)
		http.Error(w, "Failed to update channel read status", http.StatusInternalServerError)
		return
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		p.logError("[API] Failed to commit transaction",
			"error", err.Error(),
		)
		http.Error(w, "Failed to commit transaction", http.StatusInternalServerError)
		return
	}

	// Broadcast receipt via WebSocket
	p.logDebug("🚀 [API] About to publish WebSocket events", "event", WebSocketEventReadReceipt, "channelID", channelID, "userID", userID, "messageID", req.MessageID)
	p.logError("🎯 [API] CRITICAL - Publishing read receipt WebSocket event", "channelID", channelID, "userID", userID, "messageID", req.MessageID, "timestamp", now)
	p.PublishReadReceipt(channelID, req.MessageID, userID, now)
	p.logError("✅ [API] CRITICAL - Published read receipt WebSocket event successfully", "channelID", channelID, "userID", userID, "messageID", req.MessageID)
	p.logDebug("✅ [API] Published read receipt WebSocket event")

	// Get all users who have read this specific message to broadcast channel readers update
	var channelEvents []store.ReadEvent
	var eventsErr error
	channelEvents, eventsErr = p.store.GetByChannel(channelID, "")
	if eventsErr != nil {
		p.logError("[API] Failed to get channel events", "channel_id", channelID, "error", eventsErr.Error())
		// Don't fail the request, just log the error
	} else {
		p.logError("[API] DEBUG: Retrieved channel events", "channel_id", channelID, "event_count", len(channelEvents), "target_message_id", req.MessageID)

		// Filter events for this specific message and extract user IDs
		userIDMap := make(map[string]bool)
		for _, event := range channelEvents {
			p.logError("[API] DEBUG: Checking event", "event_message_id", event.MessageID, "target_message_id", req.MessageID, "matches", event.MessageID == req.MessageID)
			if event.MessageID == req.MessageID {
				userIDMap[event.UserID] = true
				p.logError("[API] DEBUG: Added user to readers", "user_id", event.UserID)
			}
		}

		// Convert map to slice
		userIDs := make([]string, 0, len(userIDMap))
		for userID := range userIDMap {
			userIDs = append(userIDs, userID)
		}

		p.logDebug("🚀 [API] About to publish channel readers update", "channelID", channelID, "lastPostID", req.MessageID, "userIDs", userIDs, "reader_count", len(userIDs))
		p.PublishChannelReadersUpdate(channelID, req.MessageID, userIDs)
		p.logDebug("✅ [API] Published channel readers WebSocket event")
	}

	// Write success response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "ok",
		"event":  event,
	})
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

	var sinceMs int64 = 0
	if r.URL.Query().Get("since") != "" || r.URL.Query().Get("postID") != "" {
		var err error
		sinceMs, err = p.getSinceMillis(r)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
	}

	// Get read events for the channel since the given time
	events, err := p.store.GetByChannel(channelID, "")
	if err != nil {
		p.logError("[API] Failed to fetch channel receipts",
			"channel_id", channelID,
			"since", sinceMs,
			"error", err.Error())
		http.Error(w, "Failed to fetch channel receipts", http.StatusInternalServerError)
		return
	}

	// Filter events by timestamp if since parameter is provided
	if sinceMs > 0 {
		filteredEvents := make([]store.ReadEvent, 0)
		for _, event := range events {
			if event.Timestamp >= sinceMs {
				filteredEvents = append(filteredEvents, event)
			}
		}
		events = filteredEvents
	}

	p.logDebug("[API] Returning read receipts",
		"channel_id", channelID,
		"event_count", len(events))

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(events); err != nil {
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

// HandleGetChannelReads returns all read receipts for a channel
func (p *Plugin) HandleGetChannelReads(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	channelID := vars["channelID"]

	if channelID == "" {
		http.Error(w, "Missing channel_id", http.StatusBadRequest)
		return
	}

	userID := r.Header.Get("Mattermost-User-Id")
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	p.logDebug("[API] Getting channel reads",
		"channel_id", channelID,
		"user_id", userID,
	)

	reads, err := p.store.GetChannelReads(channelID)
	if err != nil {
		p.logError("[API] Failed to get channel reads",
			"channel_id", channelID,
			"error", err.Error(),
		)
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(reads)
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
