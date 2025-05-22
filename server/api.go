// server/api.go
package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// ذخیره یک رویداد خواندن پیام در دیتابیس (Postgres)
func (p *ReadReceiptPlugin) storeReadEvent(ev ReadEvent) error {
	if p.DB == nil {
		p.API.LogError("storeReadEvent: DB not initialized!")
		return fmt.Errorf("DB not initialized")
	}

	if enableLogging {
		p.API.LogInfo("storeReadEvent: Storing read event", "user_id", ev.UserID, "message_id", ev.MessageID, "timestamp", ev.Timestamp)
	}

	query := `
        INSERT INTO read_events (message_id, user_id, timestamp)
        VALUES ($1, $2, $3)
        ON CONFLICT (message_id, user_id) DO UPDATE SET timestamp = EXCLUDED.timestamp;
    `
	result, err := p.DB.Exec(query, ev.MessageID, ev.UserID, ev.Timestamp)
	if err != nil {
		p.API.LogError("storeReadEvent: DB insert error", "error", err.Error())
		return err
	}
	if enableLogging {
		rows, _ := result.RowsAffected()
		p.API.LogInfo("storeReadEvent: Insert result", "rows_affected", rows)
	}
	return nil
}

// ثبت رسید خواندن پیام (POST /api/v1/read)
func (p *ReadReceiptPlugin) HandleReadReceipt(w http.ResponseWriter, r *http.Request) {
	for k, v := range r.Header {
    p.API.LogInfo("Header", "key", k, "value", v)
	}

	if enableLogging {
		p.API.LogInfo("HandleReadReceipt: Received read receipt request")
	}

	var req ReadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		p.API.LogError("HandleReadReceipt: Invalid request body", "error", err.Error())
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	userID := r.Header.Get("Mattermost-User-Id")
	if userID == "" {
		p.API.LogError("HandleReadReceipt: Unauthorized, missing user ID")
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	timestamp := time.Now().Unix()
	readEvent := ReadEvent{
		MessageID: req.MessageID,
		UserID:    userID,
		Timestamp: timestamp,
	}

	if err := p.storeReadEvent(readEvent); err != nil {
		p.API.LogError("HandleReadReceipt: Failed to store event", "error", err.Error())
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	eventData := map[string]interface{}{
		"message_id": readEvent.MessageID,
		"user_id":    readEvent.UserID,
		"timestamp":  readEvent.Timestamp,
	}

	if enableLogging {
		p.API.LogInfo("HandleReadReceipt: Publishing WebSocket event", "event", eventData)
	}

	// وب‌سوکت برای بقیه کاربران ارسال می‌شود (فرستنده رو حذف می‌کنیم)
	p.API.PublishWebSocketEvent(
		"custom_mattermost-readreceipts_read_receipt",
		eventData,
		nil, // اگر بخواهی به همه broadcast شود
		// یا به شکل زیر برای حذف فرستنده (می‌توانی یکی را انتخاب کنی)
		// &model.WebsocketBroadcast{OmitUsers: map[string]bool{readEvent.UserID: true}},
	)

	w.WriteHeader(http.StatusNoContent)
}

// واکشی رسید خواندن هر پیام (GET /api/v1/receipts?message_id=...)
func (p *ReadReceiptPlugin) HandleGetReceipts(w http.ResponseWriter, r *http.Request) {
	messageID := r.URL.Query().Get("message_id")
	if messageID == "" {
		p.API.LogError("HandleGetReceipts: Missing message_id")
		http.Error(w, "Missing message_id", http.StatusBadRequest)
		return
	}
	if p.DB == nil {
		p.API.LogError("HandleGetReceipts: DB not initialized!")
		http.Error(w, "DB not initialized", http.StatusInternalServerError)
		return
	}

	if enableLogging {
		p.API.LogInfo("HandleGetReceipts: Querying receipts for", "message_id", messageID)
	}

	query := "SELECT user_id FROM read_events WHERE message_id = $1"
	rows, err := p.DB.Query(query, messageID)
	if err != nil {
		p.API.LogError("HandleGetReceipts: DB error", "error", err.Error())
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var users []string
	for rows.Next() {
		var userID string
		if err := rows.Scan(&userID); err == nil {
			users = append(users, userID)
		}
	}
	if err := rows.Err(); err != nil {
		p.API.LogError("HandleGetReceipts: Row scan error", "error", err.Error())
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	if enableLogging {
		p.API.LogInfo("HandleGetReceipts: Found receipts", "users", users)
	}

	resp := map[string][]string{"seen_by": users}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
