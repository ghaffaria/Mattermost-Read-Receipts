package store

import (
	"database/sql"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	_ "github.com/go-sql-driver/mysql"
)

func setupMySQLTestStore(t *testing.T) *MySQLStore {
	// Use environment variables for connection details in CI/CD
	dsn := "root:rootpass@tcp(localhost:3307)/read_receipts_test?parseTime=true&multiStatements=true"
	db, err := sql.Open("mysql", dsn)
	require.NoError(t, err)
	require.NoError(t, db.Ping())

	// Clean up any existing test data
	_, err = db.Exec("DROP TABLE IF EXISTS read_events")
	require.NoError(t, err)

	store := NewMySQLStore(db)
	require.NoError(t, store.Initialize())
	return store
}

func TestMySQLStore(t *testing.T) {
	store := setupMySQLTestStore(t)

	t.Run("test upsert and get", func(t *testing.T) {
		event := ReadEvent{
			MessageID: "channel1:msg1",
			UserID:    "user1",
			Timestamp: time.Now().Unix(),
		}

		// Test insert
		err := store.Upsert(event)
		require.NoError(t, err)

		// Test get
		events, err := store.GetByChannel("channel1", "user2")
		require.NoError(t, err)
		require.Len(t, events, 1)
		assert.Equal(t, event.MessageID, events[0].MessageID)
		assert.Equal(t, event.UserID, events[0].UserID)
		assert.Equal(t, event.Timestamp, events[0].Timestamp)

		// Test update (upsert with same message_id and user_id)
		event.Timestamp = time.Now().Unix()
		err = store.Upsert(event)
		require.NoError(t, err)

		events, err = store.GetByChannel("channel1", "user2")
		require.NoError(t, err)
		require.Len(t, events, 1)
		assert.Equal(t, event.Timestamp, events[0].Timestamp)
	})

	t.Run("test cleanup", func(t *testing.T) {
		// Drop any existing data first
		_, err := store.db.Exec("DELETE FROM read_events")
		require.NoError(t, err)

		oldEvent := ReadEvent{
			MessageID: "channel1:msg2",
			UserID:    "user1",
			Timestamp: time.Now().AddDate(0, 0, -31).Unix(), // 31 days old
		}
		newEvent := ReadEvent{
			MessageID: "channel1:msg3",
			UserID:    "user1",
			Timestamp: time.Now().Unix(),
		}

		require.NoError(t, store.Upsert(oldEvent))
		require.NoError(t, store.Upsert(newEvent))

		// Cleanup events older than 30 days
		require.NoError(t, store.CleanupOlderThan(30))

		// Only the new event should remain
		events, err := store.GetByChannel("channel1", "user2")
		require.NoError(t, err)
		require.Len(t, events, 1, "expected only one event after cleanup")
		assert.Equal(t, newEvent.MessageID, events[0].MessageID)
	})
}
