# Bogart Discord Bot

A quirky Discord bot that brings the charm of a mischievous goblin named Bogart to your Discord server. Bogart sends periodic "wandering messages" to channels, sharing his goblin wisdom, potion-brewing adventures, and movie-watching enthusiasm.

## Features

-   **Wandering Messages**: Periodic messages sent to Discord channels every 12 hours.
-   **Channel-Specific Content**: Specialized messages for channels like `goblin-cave`, `murky-swamp`, etc.
-   **Extensible Quote System**: Easily customizable messages via a YAML configuration file.
-   **Dockerized**: Comes with a fully configured, production-ready Docker setup.
-   **Modular Architecture**: Clean, service-oriented design for easy maintenance.
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

Next, edit the `.env` file and add your Discord bot token and guild ID:

```
DISCORD_TOKEN=your_discord_bot_token_here
GUILD_ID=your_guild_id_for_testing
```

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

| Variable        | Description                      | Default           | Required |
| --------------- | -------------------------------- | ----------------- | :------: |
| `DISCORD_TOKEN` | Your Discord bot token.          | -                 |    ✅    |
| `GUILD_ID`      | The ID of your Discord server.   | -                 |    ✅    |
| `QUOTES_FILE`   | Path to the quotes YAML file.    | `data/quotes.yaml` |    ❌    |
| `LOG_LEVEL`     | The logging level.               | `info`            |    ❌    |
| `NODE_ENV`      | The runtime environment.         | `production`      |    ❌    |

### Quotes

All bot messages are defined in `data/quotes.yaml`. You can add or modify messages without needing to rebuild the Docker image.

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

---

*May your Discord server be filled with goblin mischief and movie magic! 🧙‍♂️✨*