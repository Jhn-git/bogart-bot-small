# Bogart Discord Bot

A quirky and resilient Discord bot that brings the charm of a mischievous goblin named Bogart to all your Discord servers. Bogart now supports multiple guilds, sending periodic "wandering messages" with enhanced security and zero manual configuration. This update resolves a critical bug that previously caused mass messaging across guilds.

## Multi-Guild Operation & Spam Prevention

Bogart now operates safely across all guilds it is invited to by default. The `ALLOWED_GUILD_IDS` environment variable is **optional** and intended for development/testing only. In production, the bot uses intelligent channel discovery and per-guild rate limiting to prevent spam and ensure safe operation.

## Features

-   **Multi-Guild Support**: Works seamlessly across multiple Discord servers simultaneously.
-   **Intelligent Channel Discovery**: Automatically finds suitable channels to post in, requiring no manual configuration.
-   **Improved Security**: Includes permission validation, rate limiting, and NSFW channel filtering.
-   **Wandering Messages**: Sends periodic messages to channels every 12 hours.
-   **Extensible Quote System**: Easily customizable messages via a YAML configuration file.
-   **Dockerized**: Comes with a fully configured, production-ready Docker setup.
-   **Comprehensive Test Suite**: Full test coverage with Jest.

## Quick Start (Docker)

This is the recommended method for running the Bogart bot.

### Prerequisites

-   Docker Engine 20.10+
-   Docker Compose 2.0+

### 1. Set Up Environment

First, create a `.env` file from the example template:

```bash
cp .env.example .env
```

Next, edit the `.env` file and add your Discord bot token. Optionally, for development/testing, you can restrict the bot to specific guilds:

```
DISCORD_TOKEN=your_discord_bot_token_here

# (Optional, for development/testing only)
# ALLOWED_GUILD_IDS=1105309398705897633
```

In production, leave `ALLOWED_GUILD_IDS` unset to allow the bot to operate in all invited guilds.

### 2. Run the Bot

You can run the bot in either development or production mode.

**Development Mode (with hot-reload):**

```bash
docker-compose up bogart-bot-dev --build
```

**Production Mode:**

```bash
docker-compose up bogart-bot --build -d
```

## Deployment

### Docker Deployment

The included `docker-compose.yml` file defines two services: `bogart-bot` (production) and `bogart-bot-dev` (development).

-   **Production**: A lean, security-hardened image optimized for performance. It runs as a non-root user with a read-only filesystem.
-   **Development**: A container with hot-reloading, enabling you to see code changes instantly without rebuilding the image.

To manage the services, use standard Docker Compose commands:

```bash
# View logs (for production)
docker-compose logs -f bogart-bot

# Stop services
docker-compose down
```

### Manual Deployment

If you prefer not to use Docker, you can run the bot directly with Node.js.

#### Prerequisites

-   Node.js 18+
-   npm or yarn

#### 1. Installation

```bash
git clone <repository-url>
cd bogat-bot-small
npm install
```

#### 2. Configuration

Set up your `.env` file as described in the Docker Quick Start.

#### 3. Running the Bot

```bash
# Start in production mode
npm start

# Start in development mode (with auto-restart)
npm run dev
```

For long-term production use, a process manager like PM2 is recommended:

```bash
npm install -g pm2
pm2 start dist/main.js --name "bogart-bot"
```

## Development

### Project Structure

```
src/
├── main.ts                 # Application entry point
├── container.ts            # Dependency injection container
├── types.ts                # TypeScript type definitions
└── services/
    ├── config.service.ts   # Configuration management
    ├── discord.service.ts  # Discord.js integration
    ├── quote.service.ts    # Quote selection logic
    └── wandering.service.ts# Periodic message scheduling
```

### Testing

The project uses Jest for testing. Mocks are centralized in `src/__tests__/mocks.ts` to ensure consistency.

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Contributing

1.  Fork the repository.
2.  Create a feature branch.
3.  Add your changes and include tests for any new functionality.
4.  Ensure all tests pass by running `npm test`.
5.  Submit a pull request.

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
| :--- | :--- | :--- | :---: |
| `DISCORD_TOKEN` | Your Discord bot token. | - | ✅ |
| `ALLOWED_GUILD_IDS` | (Optional, dev/testing only) Comma-separated list of Discord Server (Guild) IDs to restrict bot operation. | unset | ❌ |
| `QUOTES_FILE` | Path to the quotes YAML file. | `data/quotes.yaml` | ❌ |
| `LOG_LEVEL` | The logging level. | `info` | ❌ |
| `NODE_ENV` | The runtime environment. | `production` | ❌ |
| `CLEANUP_MODE` | If `true`, runs the message cleanup on startup. | `false` | ❌ |

### Quotes

All bot messages are defined in `data/quotes.yaml`. You can add or modify messages without needing to rebuild the Docker image.

## Architecture

The bot has been redesigned with a robust, multi-guild architecture that prevents the critical bugs present in the previous single-guild design. The new system uses an intelligent channel discovery algorithm and per-guild rate limiting to find safe and appropriate channels for posting messages, eliminating the need for hardcoded channel IDs and preventing spam.

For a detailed explanation of the new architecture, see [ARCHITECTURE.md](ARCHITECTURE.md).

```yaml
# Generic messages for any channel
generic_wandering_messages:
  - "Bogart's generic wisdom..."

# Channel-specific messages
goblin_wandering_messages:
  goblin-cave:
    - "A special message just for the goblin cave."
  murky-swamp:
    - "Something slimy this way comes..."
```

## Emergency Message Cleanup

An emergency cleanup system is available to remove messages sent by Bogart after the mass-messaging incident. This tool is designed with multiple safeguards to prevent accidental data loss and should be used with care.

### How It Works

The cleanup service scans all channels the bot can access and deletes messages that meet the following criteria:
1.  **Author**: Only messages sent by Bogart are targeted.
2.  **Timeframe**: Only messages sent within the last 48 hours (configurable) are considered.
3.  **Permissions**: The bot must have the `Manage Messages` permission in the channel.

### Safety First: Built-in Safeguards

-   **Targeted Deletion**: The script **only** targets messages sent by the bot itself.
-   **Default Dry-Run**: By default, the script runs in "dry-run" mode, showing what *would* be deleted without actually deleting anything.
-   **Confirmation Required**: You must explicitly use `--confirm` or set `CLEANUP_MODE=true` to perform deletions.
-   **Rate Limiting**: A delay is enforced between deletions to avoid hitting Discord's rate limits.

### Usage

There are three ways to run the cleanup process.

#### Method 1: Startup Mode (Recommended for Docker)

Set the `CLEANUP_MODE` environment variable to `true` to run the cleanup immediately on bot startup. This is the simplest method for Docker deployments.

1.  **Edit your `.env` file:**
    ```
    DISCORD_TOKEN=your_discord_bot_token_here
    CLEANUP_MODE=true
    ```
2.  **Run the bot:**
    ```bash
    # The cleanup will run once, and then the bot will exit.
    docker-compose up bogart-bot --build
    ```
    **Note**: The container will stop after the cleanup is complete. To run the bot normally again, set `CLEANUP_MODE` back to `false`.

#### Method 2: Manual CLI Script

For more control, you can execute the cleanup script directly.

**Docker Execution:**
```bash
# Run in dry-run mode to see what would be deleted
docker-compose exec bogart-bot npm run cleanup -- --dry-run

# Run in cleanup mode (with confirmation)
docker-compose exec bogart-bot npm run cleanup -- --confirm
```

**Manual Execution:**
```bash
# Run in dry-run mode
npm run cleanup -- --dry-run

# Run in cleanup mode (with confirmation)
npm run cleanup -- --confirm
```

#### Method 3: Programmatic Cleanup

The `MessageCleanupService` can be used programmatically within the application for custom cleanup logic. See [`src/services/message-cleanup.service.ts`](src/services/message-cleanup.service.ts) for details.

### CLI Options

| Flag | Description | Default |
| :--- | :--- | :--- |
| `--dry-run` | Log messages that would be deleted without performing any action. | `true` (if `CLEANUP_MODE` is not `true`) |
| `--confirm` | Confirms that you want to delete messages. Required for actual deletion. | `false` |
| `--hours=<N>` | Sets the cleanup timeframe to the last `N` hours. | `48` |

**Example:** Delete messages from the last 72 hours.
```bash
npm run cleanup -- --confirm --hours=72
```

### Troubleshooting

- **Permission Errors**: If you see "Missing permissions" errors, ensure your bot has the `Manage Messages` permission in the affected channels.
- **Rate Limiting**: The script includes a 1.2-second delay between deletions. If you still encounter rate-limiting issues, you may need to run the script again.

---

*May your Discord server be filled with goblin mischief and movie magic! 🧙‍♂️✨*