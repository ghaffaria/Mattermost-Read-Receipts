// server/api.go
// server/api.go

package main

import (
    "encoding/json"
    "net/http"
    "time"
    "fmt"

    "github.com/arg/mattermost-readreceipts/server/types"
    "github.com/mattermost/mattermost-server/v6/model"
)

// ذخیره یک رویداد خواندن پیام در دیتابیس
func (p *ReadReceiptPlugin) storeReadEvent(ev types.ReadEvent) error {
    if p.DB == nil {
        p.API.LogError("DB not initialized!")
        return fmt.Errorf("DB not initialized")
    }
    if enableLogging {
        p.API.LogInfo("storeReadEvent: Storing read event", "user_id", ev.UserID, "message_id", ev.MessageID, "timestamp", ev.Timestamp)
    }
    _, err := p.DB.Exec(
        "INSERT OR IGNORE INTO read_events (message_id, user_id, timestamp) VALUES (?, ?, ?)",
        ev.MessageID, ev.UserID, ev.Timestamp,
    )
    if err != nil && enableLogging {
        p.API.LogError("storeReadEvent: DB insert error", "error", err.Error())
    }
    return err
}

// هندل کردن POST /api/v1/read برای ثبت رسید خواندن پیام
func (p *ReadReceiptPlugin) HandleReadReceipt(w http.ResponseWriter, r *http.Request) {
    if enableLogging {
        p.API.LogInfo("HandleReadReceipt: Received read receipt request")
    }

    var req types.ReadRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        p.API.LogError("HandleReadReceipt: Invalid request body", "error", err.Error())
        http.Error(w, "Invalid request body", http.StatusBadRequest)
        return
    }

    userID := r.Header.Get("Mattermost-User-ID")
    if userID == "" {
        p.API.LogError("HandleReadReceipt: Unauthorized, missing user ID")
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

    p.API.PublishWebSocketEvent(
        "custom_mattermost-readreceipts_read_receipt",
        eventData,
        &model.WebsocketBroadcast{
            OmitUsers: map[string]bool{readEvent.UserID: true},
        },
    )

    w.WriteHeader(http.StatusOK)
}

// هندل کردن GET /api/v1/receipts?message_id= برای واکشی receiptهای هر پیام
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

    rows, err := p.DB.Query("SELECT user_id FROM read_events WHERE message_id = ?", messageID)
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

    if enableLogging {
        p.API.LogInfo("HandleGetReceipts: Found receipts", "users", users)
    }

    resp := map[string][]string{"seen_by": users}
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(resp)
}
