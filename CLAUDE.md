# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bogart is a Discord bot that sends periodic "wandering messages" across multiple Discord servers. This is the production backup system while the main production is under repairs.

## Key Commands

```bash
# Development
npm run dev                 # Start with hot-reload using nodemon
npm start                   # Start in production mode

# Building and Testing
npm run build              # Compile TypeScript to JavaScript
npm test                   # Run Jest test suite
npm run test:watch         # Run tests in watch mode
npm run test:coverage      # Run tests with coverage report

# Validation
npm run validate           # Build and test together
npm run validate:system    # System validation checks
npm run setup              # Install dependencies and validate system

# Message Cleanup (Emergency)
CLEANUP_MODE=true npm start           # Run cleanup on startup
npm run cleanup -- --dry-run          # Preview what would be deleted
npm run cleanup -- --confirm          # Actually delete messages
npm run cleanup -- --confirm --hours=72  # Delete from last 72 hours
```

Note: Linting is not yet configured (`npm run lint` just echoes a message).

## Architecture

### Multi-Guild Design
The bot operates across multiple Discord servers simultaneously with guild isolation to prevent cross-server message leaks. Each guild is processed independently with its own channel discovery and message scheduling.

### Service Architecture
Uses dependency injection pattern via `container.ts`:

- **ConfigService**: Environment configuration and YAML quote loading
- **DiscordService**: Discord.js client wrapper and authentication  
- **GuildService**: Guild discovery and management across multiple servers
- **ChannelDiscoveryService**: Intelligent channel selection algorithm
- **QuoteService**: Message content management from `data/quotes.yaml`
- **WanderingService**: 12-hour periodic message scheduling per guild
- **MessageCleanupService**: Emergency cleanup system for mass-message incidents

### Channel Discovery Algorithm
Automatically finds suitable channels by:
1. Filtering for required permissions (ViewChannel, SendMessages, ReadMessageHistory)
2. Excluding NSFW channels and inactive channels
3. Scoring channels based on recent activity and name patterns
4. Randomly selecting from appropriate channels

### Emergency Cleanup System
Built-in safeguards for mass-message incidents:
- Targets only bot's own messages within configurable timeframe (default 48 hours)
- Dry-run mode by default
- Requires explicit `--confirm` flag for actual deletions
- Rate limiting to respect Discord API limits

## Environment Configuration

Required:
- `DISCORD_TOKEN`: Bot authentication token

Optional:
- `QUOTES_FILE`: Path to quotes YAML (default: `data/quotes.yaml`)
- `LOG_LEVEL`: Logging verbosity (default: `info`)
- `NODE_ENV`: Runtime environment (default: `production`)
- `CLEANUP_MODE`: Set to `true` to run cleanup on startup

## Testing

Uses Jest with centralized mocks in `tests/helpers/mocks.ts`. Test files are located in `src/services/__tests__/` following the pattern `*.service.test.ts`.

Run single test file:
```bash
npm test -- channel-discovery.service.test.ts
```

## Docker Deployment

Two service configurations in `docker-compose.yml`:
- `bogart-bot`: Production service (read-only filesystem, non-root user)
- `bogart-bot-dev`: Development service with volume mounting for hot-reload

## Zero-Configuration Design

The bot requires no guild IDs or channel IDs in configuration. It automatically discovers suitable channels in all guilds it joins, making it immediately operational when invited to new servers.