// server/plugin.go

package main

import (
	"database/sql"
	"os"

	_ "github.com/lib/pq"
	"github.com/mattermost/mattermost-server/v6/plugin"
)

type Plugin struct {
	plugin.MattermostPlugin
	DB            *sql.DB
	enableLogging bool
}

func (p *Plugin) OnActivate() error {
	p.enableLogging = true

	dsn := os.Getenv("MM_SQLSETTINGS_DATASOURCE")
	if dsn == "" {
		dsn = "postgres://mmuser:mostest@db:5432/mattermost?sslmode=disable"
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		p.API.LogError("Failed to connect DB", "err", err.Error())
		return err
	}
	if err := db.Ping(); err != nil {
		p.API.LogError("Failed to ping DB", "err", err.Error())
		return err
	}
	p.DB = db

	if err := CreateTableIfNotExists(p.DB); err != nil {
		p.API.LogError("Failed to create table", "err", err.Error())
		return err
	}

	return nil
}
