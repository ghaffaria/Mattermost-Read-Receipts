# Mattermost Read Receipts Plugin

This plugin adds WhatsApp/Telegram-style read receipts functionality to Mattermost, allowing users to see who has read their messages. It includes both server-side and webapp components with real-time visibility tracking.

## Features

- Real-time visibility tracking of messages
- Precise read receipt detection (2-second visibility threshold)
- Database persistence of read events
- WebSocket-based real-time updates
- Displays read receipts next to messages in the Mattermost webapp
- Debug endpoints for troubleshooting
- Configurable via the System Console

## Prerequisites

- Mattermost server version 6.0 or higher.
- Node.js (v18 or higher) and npm installed.
- Go (v1.20 or higher) installed.

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Mattermost-Read-Receipts
```

### 2. Build the Server Plugin

1. Navigate to the root directory.

2. Run the following command to build the server plugin:

   ```bash
   make dist
   ```

3. The plugin bundle will be created in the `dist/` directory.

### 3. Build the Webapp

1. Navigate to the `webapp/` directory:

   ```bash
   cd webapp
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Build the webapp:

   ```bash
   npm run build
   ```

4. The webapp bundle will be created in the `webapp/dist/` directory.

### 4. Deploy the Plugin

1. Upload the server plugin bundle (`mattermost-readreceipts-<version>.tar.gz`) via the Mattermost System Console → Plugin Management.

2. Enable the plugin.

## Development

### Docker Development Environment

The plugin includes a Docker-based development environment that makes it easy to get started:

1. Make sure you have Docker and Docker Compose installed.

2. Start the development environment:

   ```bash
   docker-compose up -d
   ```

3. Access Mattermost at `http://localhost:8065`

The Docker environment includes:
- Mattermost Team Edition server
- PostgreSQL database
- Auto-loading of plugin changes
- Hot-reloading for webapp development

### Server Development

1. Run `go mod tidy` to ensure all dependencies are installed.

2. Use `go test ./...` to run the server tests.

3. Use `go vet ./...` to check for code issues.

4. The server includes debug endpoints for troubleshooting:
   - `/api/v1/debug/ping`: Check API connectivity
   - `/api/v1/debug/db`: Verify database connection and schema

### Webapp Development

1. Start the development server:

   ```bash
   npm run watch
   ```

2. The webapp will automatically rebuild on file changes.

3. Key components:
   - `VisibilityTracker`: Handles message visibility detection
   - `PostReceipt`: Manages read receipt UI
   - `ReadReceiptRootObserver`: Coordinates receipt tracking

## Configuration

### System Console Settings

- **Enable Read Receipts**: Toggle to enable or disable the read receipts feature.
- **Enable Logging**: Toggle to enable or disable logging for debugging purposes.

## File Structure

- `server/`: Contains the Go code for the server plugin.
- `webapp/`: Contains the React code for the webapp plugin.
- `Makefile`: Automates the build process.
- `README.md`: Documentation for the plugin.

## Debugging

### Frontend Debugging

The plugin includes comprehensive debug logging that can be viewed in the browser console:
- Visibility tracking events (👁️)
- API request/response logs (📤/📨)
- WebSocket events (🔌)
- Database operations (💾)

### Backend Debugging

1. View server logs in Docker:
   ```bash
   docker-compose logs -f app
   ```

2. Check database connectivity:
   ```bash
   curl http://localhost:8065/plugins/mattermost-readreceipts/api/v1/debug/db
   ```

3. Verify plugin activation:
   ```bash
   curl http://localhost:8065/plugins/mattermost-readreceipts/api/v1/debug/ping
   ```

## Troubleshooting

Common issues and solutions:

1. Read receipts not appearing
   - Check browser console for visibility tracking logs
   - Verify API requests are being sent
   - Check server logs for any errors
   - Verify database connectivity with debug endpoint

2. Database connection issues
   - Ensure PostgreSQL is running (`docker-compose ps`)
   - Check database logs (`docker-compose logs db`)
   - Verify schema exists using debug endpoint

3. Plugin not loading
   - Check System Console → Plugin Management
   - Verify plugin bundle is properly built
   - Check server logs for activation errors

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request.

## License

This project is licensed under the MIT License. See the LICENSE file for details.
