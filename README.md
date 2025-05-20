# Mattermost Read Receipts Plugin

This plugin adds read receipts functionality to Mattermost, allowing users to see who has read their messages. It includes both server-side and webapp components.

## Features

- Tracks message read events and stores them in the database.
- Displays read receipts next to messages in the Mattermost webapp.
- Configurable via the System Console.

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

### Server Development

1. Run `go mod tidy` to ensure all dependencies are installed.

2. Use `go test ./...` to run the server tests.

3. Use `go vet ./...` to check for code issues.

### Webapp Development

1. Start the development server:

   ```bash
   npm run watch
   ```

2. The webapp will automatically rebuild on file changes.

## Configuration

### System Console Settings

- **Enable Read Receipts**: Toggle to enable or disable the read receipts feature.
- **Enable Logging**: Toggle to enable or disable logging for debugging purposes.

## File Structure

- `server/`: Contains the Go code for the server plugin.
- `webapp/`: Contains the React code for the webapp plugin.
- `Makefile`: Automates the build process.
- `README.md`: Documentation for the plugin.

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request.

## License

This project is licensed under the MIT License. See the LICENSE file for details.
