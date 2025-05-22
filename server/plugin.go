// server/plugin.go
package main

import (
	"database/sql"
	"net/http"
	"os"

	_ "github.com/lib/pq"
	"github.com/mattermost/mattermost-server/v6/plugin"
)

// ReadReceiptPlugin is the main plugin struct.
type ReadReceiptPlugin struct {
	plugin.MattermostPlugin
	DB            *sql.DB
	enableLogging bool
}

func (p *ReadReceiptPlugin) OnActivate() error {
	p.loadConfiguration()

	if p.enableLogging {
		p.API.LogInfo("Activating ReadReceiptPlugin...")
	}

	// گرفتن Connection String از env یا fallback (مطابق docker-compose)
	dsn := os.Getenv("MM_SQLSETTINGS_DATASOURCE")
	if dsn == "" {
		dsn = "postgres://mmuser:mostest@db:5432/mattermost?sslmode=disable&connect_timeout=10&binary_parameters=yes"
	}

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		p.API.LogError("❌ Failed to open Postgres database", "error", err.Error(), "dsn", dsn)
		return err
	}
	// 1. تست اتصال
	if err := db.Ping(); err != nil {
		p.API.LogError("❌ FAILED to ping DB!", "error", err.Error())
		return err
	} else {
		p.API.LogInfo("✅ Connected to Postgres database")
	}

	// 2. ثبت یوزر و دیتابیس
	var dbName, dbUser string
	dbErr := db.QueryRow("SELECT current_database(), current_user").Scan(&dbName, &dbUser)
	if dbErr != nil {
		p.API.LogError("❌ Could not fetch db/user", "error", dbErr.Error())
	} else {
		p.API.LogInfo("🔗 Connected to DB", "database", dbName, "user", dbUser)
	}

	p.DB = db

	// 3. ساخت جدول با لاگ کامل
	if err := CreateTableIfNotExists(p.DB); err != nil {
		p.API.LogError("❌ Failed to initialize DB table", "error", err.Error())
		return err
	}

	if p.enableLogging {
		p.API.LogInfo("🎉 ReadReceiptPlugin activated successfully with Postgres.")
	}

	return nil
}

func (p *ReadReceiptPlugin) loadConfiguration() {
	p.enableLogging = true // hardcoded; replace with dynamic config if needed
}

// ServeHTTP routes API requests to the correct handler.
func (p *ReadReceiptPlugin) ServeHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
	if p.enableLogging {
		p.API.LogInfo("[ServeHTTP] Incoming HTTP request", "method", r.Method, "path", r.URL.Path)
	}

	switch {
	case r.Method == "POST" && r.URL.Path == "/api/v1/read":
		p.HandleReadReceipt(w, r)
		return
	// می‌توانید مسیرهای بیشتر اینجا اضافه کنید (مثلا GET برای دریافت داده‌ها)
	default:
		if p.enableLogging {
			p.API.LogInfo("[ServeHTTP] 404 Not Found", "method", r.Method, "path", r.URL.Path)
		}
		http.NotFound(w, r)
		return
	}
}
