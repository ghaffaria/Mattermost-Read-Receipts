package server

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/arg/mattermost-readreceipts/server/types"
	"github.com/mattermost/mattermost-server/v6/plugin/plugintest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockPlugin is a mock implementation of ReadReceiptPlugin for testing.
type MockPlugin struct {
	ReadReceiptPlugin
	mock.Mock
}

func TestHandleReadReceipt(t *testing.T) {
	// Create a mock plugin.
	mockPlugin := new(MockPlugin)

	// Initialize the mock API.
	mockAPI := &plugintest.API{}
	mockPlugin.SetAPI(mockAPI)

	// Set up expectations for the mock API.
	mockAPI.On("LogInfo", "Received read receipt request").Return(nil)
	mockAPI.On("LogInfo", "Read event stored successfully", "message_id", "sample-message-id", "user_id", "sample-user-id").Return(nil)
	mockAPI.On("LogInfo", "WebSocket event broadcasted", "payload", mock.Anything).Return(nil)
	mockAPI.On(
		"PublishWebSocketEvent",
		"read_receipt", // event name
		mock.AnythingOfType("map[string]interface {}"), // payload
		mock.AnythingOfType("*model.WebsocketBroadcast"),
	).Return(nil)

	// Create a sample read event request.
	readEvent := types.ReadEvent{
		MessageID: "sample-message-id",
		UserID:    "sample-user-id",
		Timestamp: time.Now().Unix(),
	}
	requestBody, _ := json.Marshal(map[string]string{
		"message_id": readEvent.MessageID,
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/read", bytes.NewReader(requestBody))
	req.Header.Set("Mattermost-User-ID", readEvent.UserID)
	w := httptest.NewRecorder()

	// Call the handler.
	http.HandlerFunc(mockPlugin.HandleReadReceipt).ServeHTTP(w, req)

	// Verify the response.
	assert.Equal(t, http.StatusOK, w.Result().StatusCode)

	// Assert expectations for WebSocket events.
	assert.NotZero(t, readEvent.Timestamp)
	mockAPI.AssertExpectations(t)
}
