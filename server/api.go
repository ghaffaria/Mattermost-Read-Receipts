// server/api.go

package main

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gorilla/mux"
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
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	readEvent := ReadEvent{
		MessageID: req.MessageID,
		UserID:    userID,
		Timestamp: time.Now().Unix(),
	}
	if err := p.storeReadEvent(readEvent); err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (p *Plugin) HandleGetReceipts(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusNotImplemented)
	w.Write([]byte("HandleGetReceipts is not yet implemented"))
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
