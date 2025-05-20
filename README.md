# Mattermost Read Receipts Plugin

This plugin adds read receipts functionality to Mattermost, allowing users to see who has read their messages.

## Installation

1. Build the plugin by running:
   ```bash
   make dist
   ```

2. Navigate to the Mattermost System Console → Plugin Management.

3. Upload the generated plugin bundle from the `dist` directory (e.g., `mattermost-readreceipts-0.1.0.tar.gz`).

4. Enable the plugin in the System Console.

## Development

- Use the `make dist` command to build the plugin.
- Ensure you have the required dependencies installed for building Mattermost plugins.
