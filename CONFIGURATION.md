# Configuration

Bogart's behavior can be customized using environment variables. These can be set in a `.env` file in the project root or directly in your deployment environment.

## Environment Variables

| Variable | Description | Default | Required |
| :--- | :--- | :--- | :---: |
| `DISCORD_TOKEN` | Your Discord bot token. | - | ✅ |
| `ALLOWED_GUILD_IDS` | (Optional, dev/testing only) Comma-separated list of Discord Server (Guild) IDs to restrict bot operation. | unset | ❌ |
| `QUOTES_FILE` | Path to the quotes YAML file. | `data/quotes.yaml` | ❌ |
| `LOG_LEVEL` | The logging level. | `info` | ❌ |
| `NODE_ENV` | The runtime environment. | `production` | ❌ |
| `CLEANUP_MODE` | If `true`, runs the message cleanup on startup. | `false` | ❌ |
| `CLEANUP_MAX_MESSAGES_PER_CHANNEL` | The maximum number of recent messages to scan per channel during cleanup. | `100` | ❌ |

---

### `DISCORD_TOKEN`

This is the authentication token for your Discord bot. It is required for the bot to connect to Discord's API. You can obtain this from the Discord Developer Portal.

**Example:**
```
DISCORD_TOKEN=your_discord_bot_token_here
```

### `ALLOWED_GUILD_IDS`

Use this variable during development or testing to restrict the bot to one or more specific Discord servers (guilds). In a production environment, you should leave this variable unset to allow the bot to operate in any server it has been invited to. The bot's multi-guild security features (rate limiting, channel discovery) ensure it operates safely without this restriction.

**Example (for testing):**
```
ALLOWED_GUILD_IDS=1105309398705897633,1105309398705897634
```

### `QUOTES_FILE`

The path to the YAML file containing the bot's messages. You can customize the bot's personality by editing this file.

**Example:**
```
QUOTES_FILE=config/my_custom_quotes.yaml
```

### `LOG_LEVEL`

Defines the verbosity of the application's logs. Supported levels are `error`, `warn`, `info`, `http`, `verbose`, `debug`, and `silly`.

**Example:**
```
LOG_LEVEL=debug
```

### `CLEANUP_MODE`

When set to `true`, the bot will run the message cleanup service on startup and then exit. This is useful for running cleanup as a one-time task, especially in Docker environments.

**Example:**
```
CLEANUP_MODE=true
```

### `CLEANUP_MAX_MESSAGES_PER_CHANNEL`

This variable sets a limit on the number of recent messages the cleanup service will scan in each channel. This feature is designed to protect user privacy and improve performance by preventing the bot from scanning a channel's entire message history. It significantly reduces Discord API usage and ensures the bot's access to messages is responsibly limited.

- **Privacy**: The bot only ever sees the most recent messages, not deep history.
- **Performance**: Scanning is faster and uses fewer API resources.

**Example:**
```
# Scan up to 200 messages per channel instead of the default 100
CLEANUP_MAX_MESSAGES_PER_CHANNEL=200