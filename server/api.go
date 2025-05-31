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

	// Verify log level at the start of every read receipt request
	p.API.LogWarn("[DEBUG-RR] Current plugin log level for read receipt handling: " + p.getConfiguration().LogLevel)

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

	// Get channel info to check if it's a DM
	channel, appErr := p.API.GetChannel(channelID)
	if appErr != nil {
		p.logError("[API] Failed to get channel info", "channel_id", channelID, "error", appErr.Error())
		http.Error(w, "Failed to get channel info", http.StatusInternalServerError)
		return
	}

	// Save receipt to database first
	readEvent := store.ReadEvent{
		MessageID: req.MessageID,
		UserID:    userID,
		ChannelID: channelID,
		Timestamp: time.Now().UnixMilli(),
	}

	p.logDebug("[API] Attempting to save read event",
		"message_id", req.MessageID,
		"user_id", userID,
		"channel_id", channelID,
	)

	if err := p.store.Upsert(readEvent); err != nil {
		p.logError("[API] Failed to save read event", "error", err.Error())
		http.Error(w, "Failed to save read event", http.StatusInternalServerError)
		return
	}

	p.logDebug("[API] Successfully saved read event",
		"message_id", req.MessageID,
		"user_id", userID,
	)

	// Get all current readers for this message first
	channelEvents, storeErr := p.store.GetByChannel(channelID, "")
	if storeErr != nil {
		p.logError("[API] Failed to get channel events", "channel_id", channelID, "error", storeErr.Error())
	}

	// Initialize with current reader
	userIDs := []string{userID}
	userIDMap := map[string]bool{userID: true}

	// Add historical readers
	if storeErr == nil {
		for _, event := range channelEvents {
			if event.MessageID == req.MessageID && !userIDMap[event.UserID] {
				userIDMap[event.UserID] = true
				userIDs = append(userIDs, event.UserID)
			}
		}
	}

	if channel.Type == model.ChannelTypeDirect {
		// DM channel handling - notify the other participant only
		p.API.LogWarn("[DEBUG-RR-DM] 🔍 Starting DM read receipt processing",
			"channelID", channelID,
			"messageID", req.MessageID,
			"readerID", userID,
			"postAuthorID", post.UserId,
		)

		// Log current state of readers
		p.API.LogWarn("[DEBUG-RR-DM] 📊 Current readers state",
			"allReaders", userIDs,
			"currentReader", userID,
			"messageID", req.MessageID,
		)

		// Get DM channel members
		members, appErr := p.API.GetChannelMembers(channelID, 0, 2)
		if appErr != nil {
			p.logError("[API] Failed to get DM members", "channel_id", channelID, "error", appErr.Error())
			http.Error(w, "Failed to get DM members", http.StatusInternalServerError)
			return
		}

		p.API.LogWarn("[DEBUG-RR-DM] 👥 DM channel members retrieved",
			"memberCount", len(members),
			"channelID", channelID,
		)

		// Send to other DM participant only
		for _, member := range members {
			if member.UserId != userID {
				// Build event data with detailed state
				eventData := map[string]interface{}{
					"MessageID": req.MessageID,
					"UserID":    userID,
					"ChannelID": channelID,
					"IsDM":      true,
					"Timestamp": readEvent.Timestamp,
					"ReaderIDs": userIDs,
					"Author":    post.UserId,
				}

				p.API.LogWarn("[DEBUG-RR-DM] 📨 Preparing to send DM read receipt",
					"targetUserID", member.UserId,
					"messageID", req.MessageID,
					"readerIDs", userIDs,
					"eventData", eventData,
				)

				// Send to other participant
				p.API.PublishWebSocketEvent(
					WebSocketEventReadReceipt,
					eventData,
					&model.WebsocketBroadcast{
						UserId: member.UserId,
					},
				)

				p.API.LogWarn("[DEBUG-RR-DM] ✅ Sent read receipt to DM participant",
					"targetUserID", member.UserId,
					"messageID", req.MessageID,
				)

				// If message author is different from both participants, notify them too
				if post.UserId != member.UserId && post.UserId != userID {
					p.API.LogWarn("[DEBUG-RR-DM] 📨 Sending read receipt to message author",
						"authorID", post.UserId,
						"messageID", req.MessageID,
					)

					p.API.PublishWebSocketEvent(
						WebSocketEventReadReceipt,
						eventData,
						&model.WebsocketBroadcast{
							UserId: post.UserId,
						},
					)

					p.API.LogWarn("[DEBUG-RR-DM] ✅ Sent read receipt to message author",
						"authorID", post.UserId,
						"messageID", req.MessageID,
					)
				}

				p.API.LogWarn("[DEBUG-RR-DM] 🏁 Completed DM read receipt processing",
					"messageID", req.MessageID,
					"readerID", userID,
					"channelID", channelID,
				)

				break // Only need to send to one other participant
			}
		}
	} else {
		// Standard channel broadcast logic
		p.API.LogWarn("[DEBUG-RR] Processing read receipt for standard channel:",
			"channelID", channelID,
			"messageID", req.MessageID,
			"readerID", userID,
		)

		// Send read receipt to the author
		p.API.PublishWebSocketEvent(
			WebSocketEventReadReceipt,
			map[string]interface{}{
				"MessageID": post.Id,
				"UserID":    userID,
				"ChannelID": channelID,
			},
			&model.WebsocketBroadcast{
				UserId: post.UserId,
			},
		)

		// For regular channels, broadcast channel readers update
		p.API.LogDebug("[DEBUG-RR] Broadcasting channel readers update",
			"channelID", channelID,
			"messageID", req.MessageID,
			"readerID", userID,
		)

		// Gather all current readers for this message
		channelEvents, storeErr := p.store.GetByChannel(channelID, "")
		if storeErr != nil {
			p.logError("[API] Failed to get channel events", "channel_id", channelID, "error", storeErr.Error())
		}

		// Initialize with current reader
		userIDs := []string{userID}
		userIDMap := map[string]bool{userID: true}

		// Add historical readers
		if storeErr == nil {
			for _, event := range channelEvents {
				if event.MessageID == req.MessageID && !userIDMap[event.UserID] {
					userIDMap[event.UserID] = true
					userIDs = append(userIDs, event.UserID)
				}
			}
		}

		// Single broadcast with all readers
		p.API.PublishWebSocketEvent(
			WebSocketEventChannelReaders,
			map[string]interface{}{
				"ChannelID":  channelID,
				"LastPostID": req.MessageID,
				"UserIDs":    userIDs,
			},
			&model.WebsocketBroadcast{
				ChannelId: channelID,
			},
		)
	}

	// No final broadcast needed - DM and channel broadcasts are already handled above

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "ok",
	})
}

// HandleSimpleRead – GET /read/simple?post_id=… (helper for tests)
func (p *Plugin) HandleSimpleRead(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-Id")
	if userID == "" {
		http.Error(w, "unauth", http.StatusUnauthorized)
		return
	}
	postID := r.URL.Query().Get("post_id")
	if postID == "" {
		http.Error(w, "post_id required", 400)
		return
	}

	post, err := p.API.GetPost(postID)
	if err != nil {
		http.Error(w, "not found", 404)
		return
	}
	_ = p.readReceiptStore.MarkPostAsRead(post.Id, userID)

	// read_receipt event
	p.API.PublishWebSocketEvent(EventReadReceipt, map[string]interface{}{
		"MessageID": post.Id,
		"UserID":    userID,
		"ChannelID": post.ChannelId,
	}, &model.WebsocketBroadcast{ChannelId: post.ChannelId, OmitUsers: map[string]bool{userID: true}})

	// channel_readers aggregate
	p.API.PublishWebSocketEvent(EventChannelReaders, map[string]interface{}{
		"ChannelID":  post.ChannelId,
		"LastPostID": post.Id,
		"UserIDs":    []string{userID},
	}, &model.WebsocketBroadcast{ChannelId: post.ChannelId, OmitUsers: map[string]bool{userID: true}})
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

// Helper function to check if a user is in a list
func containsUser(users []string, userID string) bool {
	for _, u := range users {
		if u == userID {
			return true
		}
	}
	return false
}
