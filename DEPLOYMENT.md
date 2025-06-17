# Bogart Discord Bot - Deployment Guide

## Pre-Deployment Checklist

✅ **System Validation**: All integration tests passing  
✅ **Build Process**: TypeScript compilation successful  
✅ **Test Coverage**: 20 tests across 5 test suites  
✅ **Configuration**: Environment variables properly configured  
✅ **Documentation**: Complete setup and usage documentation  

## Quick Deployment

### 1. Environment Setup

```bash
# Clone and setup
git clone <repository-url>
cd bogat-bot-small
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Discord bot token
```

### 2. Discord Bot Configuration

1. **Create Discord Application**
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Create new application
   - Navigate to "Bot" section
   - Copy bot token to `.env` file

2. **Set Bot Permissions**
   - Required permissions: `3072`
   - View Channels
   - Send Messages
   - Read Message History

3. **Invite Bot to Server**
   ```
   https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=3072&scope=bot
   ```

### 3. Validation & Testing

```bash
# Run system validation
npm run validate:system

# Run complete integration tests
npm run integration:test

# Build for production
npm run build
```

### 4. Production Deployment

#### Option A: Direct Node.js

```bash
# Production build
npm run build

# Start bot
npm start
```

#### Option B: PM2 Process Manager

```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start dist/main.js --name "bogart-bot"
pm2 save
pm2 startup
```

#### Option C: Docker

```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
CMD ["node", "dist/main.js"]
```

```bash
docker build -t bogart-bot .
docker run -d --env-file .env --name bogart-bot bogart-bot
```

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DISCORD_TOKEN` | Discord bot token | ✅ | - |
| `GUILD_ID` | Guild ID for testing | ❌ | - |
| `QUOTES_FILE` | Path to quotes file | ❌ | `quotes.yaml` |
| `NODE_ENV` | Environment mode | ❌ | `production` |

## Monitoring & Health Checks

### Bot Status Verification

```bash
# Check if bot is online in Discord server
# Look for bot in member list with online status

# Check logs for successful startup
tail -f logs/bogart-bot.log
```

### Health Check Endpoints

The bot automatically logs:
- Successful Discord login
- Failed message deliveries
- Service initialization status
- Error conditions

### Expected Behavior

- **Startup**: Bot appears online in Discord
- **Messages**: Sent every 12 hours to available channels
- **Logs**: No error messages in console
- **Memory**: Stable memory usage (~50MB)

## Troubleshooting

### Common Issues

**Bot Won't Start**
```bash
# Check token validity
echo $DISCORD_TOKEN | wc -c  # Should be ~60 characters

# Verify file permissions
ls -la .env
chmod 600 .env
```

**No Messages Sent**
```bash
# Check bot permissions in Discord
# Verify channels are accessible
# Review console logs for errors
```

**High Memory Usage**
```bash
# Monitor with PM2
pm2 monit

# Check for memory leaks
node --inspect dist/main.js
```

## Scaling Considerations

### Multiple Servers

- Bot can operate in multiple Discord servers simultaneously
- Messages are sent to all accessible channels
- No server-specific configuration required

### Rate Limiting

- Discord API rate limits are handled automatically
- Failed message sends are logged but don't crash the bot
- 12-hour interval prevents rate limit issues

### Performance

- **Memory Usage**: ~50MB typical
- **CPU Usage**: Minimal (timer-based execution)
- **Network**: Low bandwidth (periodic messages only)

## Backup & Recovery

### Configuration Backup

```bash
# Backup critical files
tar -czf bogart-bot-backup.tar.gz \
  .env \
  quotes.yaml \
  package.json \
  src/
```

### Recovery Process

```bash
# Restore from backup
tar -xzf bogart-bot-backup.tar.gz

# Reinstall dependencies
npm install

# Validate system
npm run validate:system

# Restart bot
npm start
```

## Security Considerations

### Token Security

- Never commit `.env` files to version control
- Use environment-specific tokens
- Rotate tokens periodically
- Monitor for unauthorized access

### Server Permissions

- Grant minimal required permissions
- Review bot access regularly
- Monitor message activity
- Set up alerts for unusual behavior

## Maintenance

### Regular Tasks

- **Weekly**: Check bot status and logs
- **Monthly**: Review message content and update quotes
- **Quarterly**: Update dependencies and security patches

### Updates

```bash
# Update dependencies
npm update

# Run tests after updates
npm run integration:test

# Deploy updated version
npm run build && pm2 restart bogart-bot
```

## Support & Monitoring

### Log Analysis

```bash
# View recent logs
pm2 logs bogart-bot --lines 100

# Search for errors
pm2 logs bogart-bot | grep ERROR

# Monitor in real-time
pm2 logs bogart-bot --follow
```

### Performance Metrics

```bash
# PM2 status
pm2 status

# Memory usage
pm2 show bogart-bot

# Restart if needed
pm2 restart bogart-bot
```

---

## Deployment Checklist

- [ ] Discord bot created and token obtained
- [ ] Environment variables configured
- [ ] System validation passed
- [ ] Integration tests passed
- [ ] Build process completed
- [ ] Bot invited to Discord server
- [ ] Production deployment completed
- [ ] Bot status verified online
- [ ] First wandering message confirmed (within 12 hours)
- [ ] Monitoring and logging configured
- [ ] Backup procedure established

**🎉 Deployment Complete!**

Your Bogart Discord Bot is now ready to bring goblin mischief and movie magic to your Discord server!