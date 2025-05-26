
# Mattermost Read Receipts Plugin
## Download

[⬇️ Download pre-built plugin](https://github.com/ghaffaria/Mattermost-Read-Receipts/releases/download/v0.1.2/mattermost-readreceipts-2025.05.26.1827.tar.gz)


WhatsApp / Telegram style “Seen by …” indicators for every post in Mattermost.

<p align="center">
  <!-- replace with real images or delete -->
  <img src="image/channel.jpg" width="45%"/>
  <img src="image/user1.jpg"  width="45%"/>
</p>

---

## Features
|                                                           |                                        |
|-----------------------------------------------------------|----------------------------------------|
| **Real-time tracking** | Intersection Observer + WebSockets |
| **Accurate**           | fires only after a message is visible ≥ 2 s |
| **Persistent**         | receipts stored in the same DB that Mattermost uses |
| **UI**                 | WhatsApp-like inline badges:<br> `Seen by Ali, Sam` |
| **Admin-friendly**     | SysConsole settings, debug REST endpoints, structured logs |
| **House-keeping**      | automatic DB clean-up (retention_days) |

---

## Compatibility
| Component | Tested version(s) |
|-----------|------------------|
| Mattermost Server | **≥ v6.0** (Team or Enterprise) |
| PostgreSQL        | 13.x |
| MySQL / MariaDB   | 8.0 / 10.6 |

> ⚠️ **No fallback DSN.**  
> The plugin **re-uses** the connection string configured under  
> *System Console → Environment → Database*.  
> If that field is still masked (`***********`) the plugin cannot connect and will refuse to start.

---

## Quick installation

1. **Download** the latest release (`mattermost-readreceipts-<date>.tar.gz`).  
2. **System Console → Plugins → Plugin Management**  
   * Upload → Enable.  
3. Done – receipts appear next to new messages.

---

## Building from source

```bash
git clone https://github.com/<you>/mattermost-readreceipts.git
cd mattermost-readreceipts

# build webapp + server + bundle
make dist            # → dist/<timestamp>.tar.gz
````

Upload the generated archive via System Console as usual.

### Development docker-compose (optional)

```bash
docker-compose up -d          # starts Mattermost + Postgres
export MM_SQLSETTINGS_DATASOURCE="postgres://mmuser:mostest@db:5432/mattermost?sslmode=disable"
make dev                       # live-reload plugin inside the container
```

---

## Configuration options (System Console → Plugins → Read Receipts)

| Key                           | Default | Description                                                |
| ----------------------------- | ------- | ---------------------------------------------------------- |
| **Enable Read Receipts**      | `true`  | Master switch                                              |
| **Visibility Threshold (ms)** | `2000`  | How long a post must be on-screen before it is marked read |
| **Receipt Retention (days)**  | `30`    | Older rows are purged nightly                              |
| **Log Level**                 | `info`  | `debug` for verbose output                                 |

---

## Troubleshooting

| Symptom                                          | Likely cause / fix                                                                                                    |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| **`missing "=" after "********"` on activation** | The DB DSN is still masked. Paste the real DSN and click **Save** in System Console.                                  |
| Receipts never appear                            | Make sure both users run ≥ Mattermost v6 and have the plugin enabled. Check the browser console for WebSocket events. |
| Rows accumulate forever                          | Set **Retention (days)** to a non-zero value.                                                                         |

Debug endpoints (System Admin only):

* `GET …/plugins/mattermost-readreceipts/api/v1/debug/ping`
* `GET …/plugins/mattermost-readreceipts/api/v1/debug/db`

---

## Contributing

1. Fork, branch from **main**.
2. `make dev-setup` → `make test` → commit.
3. Open a pull-request – please include unit tests and README updates where relevant.

---

## License

[MIT](LICENSE)

---

### Acknowledgements

* Mattermost team for the plugin framework
* All contributors – PRs welcome!

```

---

