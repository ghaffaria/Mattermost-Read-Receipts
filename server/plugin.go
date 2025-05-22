// server/plugin.go
package main

import (
    "database/sql"
    "net/http"
    "os"

    _ "github.com/lib/pq"
    "github.com/mattermost/mattermost-server/v6/plugin"
)

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

    // گرفتن Connection String از env یا fallback
    dsn := os.Getenv("MM_SQLSETTINGS_DATASOURCE")
    if dsn == "" {
        dsn = "postgres://mmuser:mostest@db:5432/mattermost?sslmode=disable&connect_timeout=10&binary_parameters=yes"
    }

    db, err := sql.Open("postgres", dsn)
    if err != nil {
        p.API.LogError("❌ Failed to open Postgres database", "error", err.Error(), "dsn", dsn)
        return err
    }
    if err := db.Ping(); err != nil {
        p.API.LogError("❌ FAILED to ping DB!", "error", err.Error())
        return err
    } else {
        p.API.LogInfo("✅ Connected to Postgres database")
    }

    var dbName, dbUser string
    dbErr := db.QueryRow("SELECT current_database(), current_user").Scan(&dbName, &dbUser)
    if dbErr != nil {
        p.API.LogError("❌ Could not fetch db/user", "error", dbErr.Error())
    } else {
        p.API.LogInfo("🔗 Connected to DB", "database", dbName, "user", dbUser)
    }

    p.DB = db

    // ساخت جدول اگر وجود ندارد (در model.go)
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
    p.enableLogging = true
}

func (p *ReadReceiptPlugin) ServeHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
    p.API.LogInfo("[DEBUG] ServeHTTP called", "method", r.Method, "path", r.URL.Path)

    if p.enableLogging {
        p.API.LogInfo("[ServeHTTP] Incoming HTTP request", "method", r.Method, "path", r.URL.Path)
    }

    switch {
    case r.Method == "POST" && r.URL.Path == "/api/v1/read":
        // فقط اینجا Handler را صدا بزن، تعریفش باید در api.go باشد
        p.HandleReadReceipt(w, r)
        return
    default:
        if p.enableLogging {
            p.API.LogInfo("[ServeHTTP] 404 Not Found", "method", r.Method, "path", r.URL.Path)
        }
        http.NotFound(w, r)
        return
    }
}
