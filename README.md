# Bogart Discord Bot

A quirky Discord bot that brings the charm of a mischievous goblin named Bogart to your Discord server. Bogart sends periodic "wandering messages" to channels, sharing his goblin wisdom, potion-brewing adventures, and movie-watching enthusiasm.

## Features

- **Wandering Messages**: Periodic messages sent to Discord channels every 12 hours
- **Channel-Specific Content**: Specialized messages for channels like `goblin-cave`, `murky-swamp`, `whispering-woods`, etc.
- **Generic Messages**: Fallback messages for channels without specific content
- **Rich Quote System**: Over 400+ unique messages covering goblin adventures, movie enthusiasm, and potion brewing
- **Modular Architecture**: Clean separation of concerns with service-based design
- **Full Test Coverage**: Comprehensive Jest test suite

## Quick Start

### Prerequisites

- Node.js 16+ 
- npm or yarn
- A Discord application and bot token

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd bogat-bot-small
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your Discord bot token:
   ```
   DISCORD_TOKEN=your_discord_bot_token_here
   GUILD_ID=your_guild_id_for_testing
   QUOTES_FILE=quotes.yaml
   ```

4. **Run the bot**
   ```bash
   npm start
   ```

## Discord Bot Setup

### Creating a Discord Application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to the "Bot" section
4. Click "Add Bot" if not already created
5. Copy the bot token and add it to your `.env` file

### Bot Permissions

The bot requires the following permissions:
- **View Channels** - To see available channels
- **Send Messages** - To send wandering messages
- **Read Message History** - To understand channel context

**Permission Integer**: `3072`

### Inviting the Bot

Use this URL template (replace `YOUR_CLIENT_ID` with your application's client ID):
```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=3072&scope=bot
```

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DISCORD_TOKEN` | Discord bot token | - | ✅ |
| `GUILD_ID` | Guild ID for development | - | ❌ |
| `QUOTES_FILE` | Path to quotes YAML file | `quotes.yaml` | ❌ |

### Quotes Configuration

The bot uses `quotes.yaml` for message content. The file structure:

```yaml
# Generic messages for all channels
generic_wandering_messages:
  - "Bogart's message here..."

# Channel-specific messages
goblin_wandering_messages:
  goblin-cave:
    - "Cave-specific message..."
  murky-swamp:
    - "Swamp-specific message..."
```

## Development

### Available Scripts

```bash
# Start the bot
npm start

# Development mode with auto-restart
npm run dev

# Build TypeScript
npm run build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Validate build and tests
npm run validate
```

### Project Structure

```
src/
├── main.ts                 # Application entry point
├── types.ts               # TypeScript type definitions
└── services/
    ├── config.service.ts   # Configuration management
    ├── discord.service.ts  # Discord.js integration
    ├── quote.service.ts    # Quote selection logic
    ├── wandering.service.ts # Periodic message scheduling
    └── __tests__/         # Jest test files
```

### Architecture

The bot follows a service-oriented architecture:

- **ConfigService**: Manages environment variables and YAML configuration
- **DiscordService**: Handles Discord.js client and message sending
- **QuoteService**: Selects appropriate messages based on channel names
- **WanderingService**: Orchestrates periodic message sending

### Adding New Messages

1. Edit `quotes.yaml`
2. Add messages to appropriate sections
3. For channel-specific messages, add under `goblin_wandering_messages`
4. Restart the bot to load new messages

## Testing

The project includes comprehensive Jest tests:

```bash
# Run all tests
npm test

# Run tests with coverage report
npm run test:coverage

# Run tests in watch mode for development
npm run test:watch
```

### Test Coverage

- **ConfigService**: Environment variable handling and YAML parsing
- **DiscordService**: Discord client management and message sending
- **QuoteService**: Message selection logic and placeholder replacement
- **WanderingService**: Timer-based message scheduling integration

## Deployment

### Production Environment

1. **Set up environment variables**
   ```bash
   DISCORD_TOKEN=your_production_token
   NODE_ENV=production
   ```

2. **Build the application**
   ```bash
   npm run build
   ```

3. **Start the production server**
   ```bash
   node dist/main.js
   ```

### Docker Deployment (Optional)

Create a `Dockerfile`:
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
CMD ["node", "dist/main.js"]
```

### Process Managers

For production, use a process manager like PM2:
```bash
npm install -g pm2
pm2 start dist/main.js --name "bogart-bot"
pm2 save
pm2 startup
```

## Troubleshooting

### Common Issues

**Bot doesn't start**
- Check that `DISCORD_TOKEN` is set correctly
- Ensure the token has not expired
- Verify bot permissions in Discord

**Messages not sending**
- Check bot has "Send Messages" permission
- Verify bot can see the target channels
- Check console logs for error messages

**No messages appearing**
- Messages are sent every 12 hours by default
- Check that channels exist and bot has access
- Review quotes.yaml file formatting

### Debug Mode

Set `NODE_ENV=development` for additional logging:
```bash
NODE_ENV=development npm start
```

### Logs

The bot logs important events:
- Successful Discord login
- Failed message sends
- Service initialization
- Error conditions

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run `npm run validate` to ensure tests pass
6. Submit a pull request

### Code Style

- Use TypeScript for all new code
- Follow existing naming conventions
- Add JSDoc comments for public methods
- Maintain test coverage

## License

[Add your license information here]

## Support

For support and questions:
- Check the troubleshooting section
- Review the GitHub issues
- [Add contact information or Discord server]

---

*May your Discord server be filled with goblin mischief and movie magic! 🧙‍♂️✨*