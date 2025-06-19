# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Commands
- `npm start` - Start the bot in production mode
- `npm run dev` - Start in development mode with auto-restart (nodemon)
- `npm run build` - Compile TypeScript to JavaScript
- `npm run build:prod` - Build for production using tsconfig.build.json

### Testing
- `npm test` - Run all tests with Jest
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run integration:test` - Run system validation and tests

### Validation & Deployment
- `npm run validate` - Build and test (recommended before commits)
- `npm run validate:system` - Validate system configuration
- `npm run setup` - Full setup (install + validate)
- `./scripts/deploy.sh deploy` - Deploy using Docker Compose

### Cleanup Commands
- `npm run cleanup -- --dry-run` - Preview message cleanup (default behavior)
- `npm run cleanup -- --confirm` - Execute message cleanup
- `npm run cleanup -- --hours=72` - Set custom cleanup timeframe

## Architecture Overview

This is a Discord bot ("Bogart") built with TypeScript and Discord.js, designed for multi-guild operation with intelligent spam prevention.

### Core Architecture Principles
- **Multi-Guild by Design**: Operates safely across multiple Discord servers simultaneously
- **Zero Configuration**: Requires only `DISCORD_TOKEN` for production deployment
- **Intelligent Channel Discovery**: Automatically finds appropriate channels without hardcoded IDs
- **Service-Oriented**: Uses dependency injection container for clean service separation

### Key Services (src/services/)
- **ConfigService**: Environment and configuration management
- **DiscordService**: Discord.js client wrapper and connection handling
- **GuildService**: Guild (server) discovery and management
- **ChannelDiscoveryService**: Intelligent channel selection algorithm
- **QuoteService**: Message content management from YAML files
- **WanderingService**: Periodic message scheduling (12-hour intervals)
- **MessageCleanupService**: Emergency message cleanup with safety limits

### Service Dependencies
Services are wired through `src/container.ts` using constructor injection:
```
ConfigService → QuoteService
ConfigService → DiscordService → GuildService
ConfigService → ChannelDiscoveryService
All services → WanderingService
```

### Channel Discovery Algorithm
The bot uses sophisticated logic to find appropriate channels:
1. Fetches all text channels in each guild
2. Validates bot permissions (ViewChannel, SendMessages, ReadMessageHistory)
3. Filters out NSFW channels and inactive channels
4. Scores channels by activity and name patterns (prefers "general", "chat", etc.)
5. Randomly selects from suitable channels to avoid patterns

### Safety Features
- **Guild Isolation**: Each guild operates independently, preventing cross-guild messaging
- **Permission Validation**: Checks permissions before every operation
- **Rate Limiting**: 12-hour global intervals, 6-hour per-guild cooldowns
- **NSFW Filtering**: Automatically excludes NSFW channels
- **Activity Checks**: Avoids inactive or "dead" channels

## Configuration

### Required Environment Variables
- `DISCORD_TOKEN` - Discord bot token (required)

### Optional Environment Variables
- `ALLOWED_GUILD_IDS` - Comma-separated guild IDs (development/testing only)
- `QUOTES_FILE` - Path to quotes YAML file (default: `data/quotes.yaml`)
- `LOG_LEVEL` - Logging level (default: `info`)
- `NODE_ENV` - Runtime environment (default: `production`)
- `CLEANUP_MAX_MESSAGES_PER_CHANNEL` - Message scan limit for cleanup (default: `100`)

### Quote Configuration
Messages are defined in `data/quotes.yaml` with support for:
- Generic wandering messages (used in any channel)
- Channel-specific messages (matched by channel name patterns)

## Testing Strategy

- **Unit Tests**: Each service has comprehensive unit tests in `src/services/__tests__/`
- **Integration Tests**: End-to-end testing in `tests/integration/`
- **Mocking**: Centralized mocks in `tests/helpers/mocks.ts`
- **Test Setup**: Global test configuration in `tests/helpers/setup.ts`

Test files follow the pattern `*.test.ts` and are discovered by Jest automatically.

## Docker Deployment

The bot includes production-ready Docker configuration:
- **Production**: `docker-compose up bogart-bot --build -d`
- **Development**: `docker-compose up bogart-bot-dev --build`
- **Deployment Script**: `./scripts/deploy.sh` provides deployment management

## Common Development Patterns

### Adding New Services
1. Create service class in `src/services/`
2. Add corresponding unit tests in `src/services/__tests__/`
3. Register in `src/container.ts` with proper dependency injection
4. Update types in `src/types.ts` if needed

### Environment Configuration
- Development: Use `ALLOWED_GUILD_IDS` to restrict to test servers
- Production: Leave `ALLOWED_GUILD_IDS` unset for multi-guild operation
- Always validate configuration with `npm run validate:system`

### Message Cleanup Safety
The cleanup system has built-in safeguards:
- Only scans limited recent messages per channel (default 100)
- Only targets messages from the bot itself
- Requires explicit confirmation (`--confirm` flag) for actual deletion
- Defaults to dry-run mode for safety
- Completely separate from bot startup - only runs via `npm run cleanup`

## Development Guidelines

### Commit Message Guidelines
- Do not include detailed Claude AI information in commit messages
- Keep commit messages concise and focused on the specific changes made
- Avoid including internal AI-specific context or reasoning
- I like commit messages with emojis on the headers
