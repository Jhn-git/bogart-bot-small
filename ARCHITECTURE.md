# Architecture

This document outlines the multi-guild architecture of the Bogart bot, which is designed to be secure, scalable, and require zero manual configuration. This new design resolves the critical bug that previously caused the bot to send messages to unintended channels across multiple servers.

## 1. Multi-Guild Architecture

The bot is no longer restricted to a single Discord server (`Guild`). It is designed to operate in any server it has been invited to, without requiring a `GUILD_ID` to be configured in the environment variables.

### How It Works

-   **Dynamic Guild Discovery**: On startup, the bot fetches all guilds (servers) it is a member of.
-   **Independent Operation**: Each guild is treated as a separate entity. The wandering message service operates independently for each guild, ensuring that activity in one server does not impact another.
-   **Scalability**: The architecture is designed to scale horizontally. As the bot is added to more guilds, the workload is distributed, and the bot's performance remains stable.

## 2. Intelligent Channel Discovery

A key feature of the new architecture is the intelligent channel discovery service. This service automatically identifies suitable channels for the bot to send messages in, eliminating the need for `WANDERING_CHANNEL_IDS`.

### The Algorithm

For each guild, the channel discovery service performs the following steps:

1.  **Fetch Channels**: Retrieves a list of all text-based channels in the guild.
2.  **Permission Validation**: Filters the list to include only channels where the bot has the required permissions:
    -   `ViewChannel`: To see the channel.
    -   `SendMessages`: To post messages.
    -   `ReadMessageHistory`: To check for recent activity.
3.  **Security & Safety Checks**:
    -   **NSFW Filter**: Excludes any channel marked as "Not Safe For Work."
    -   **Activity Check**: Excludes channels that have been inactive for a long time to avoid reviving "dead" channels. It prioritizes channels with recent conversations.
4.  **Scoring and Selection**:
    -   Channels are scored based on factors like recent activity and whether their name suggests they are a general chat channel (e.g., `general`, `chat`, `off-topic`).
    -   A random, suitable channel is selected from the filtered and scored list.

This process ensures that Bogart only posts in active, appropriate, and safe channels.

## 3. Security and Intelligent Spam Prevention

The new architecture directly addresses the previous mass-messaging bug through intelligent design rather than restrictive configuration:

-   **Guild Isolation**: The core logic iterates through each guild independently. Channel discovery and message sending are scoped per guild, making cross-guild messaging impossible.
-   **Intelligent Rate Limiting**:
    -   Global 12-hour intervals between wandering cycles
    -   Per-guild 6-hour cooldowns to prevent spam
    -   Smart channel selection with randomization
-   **Permission-Based Safety**: The bot validates permissions before every operation, ensuring it only acts where explicitly allowed.
-   **Channel Intelligence**: Sophisticated channel discovery that:
    -   Only targets appropriate channels (general, chat, bot-related)
    -   Avoids NSFW channels automatically
    -   Respects channel permissions and visibility
-   **Development Safety**: `ALLOWED_GUILD_IDS` available for development/testing but not required for production

## 4. Production-Ready Multi-Guild Operation

The architecture is designed for safe, zero-configuration multi-guild deployment:

-   **Production Ready**: Only requires `DISCORD_TOKEN` - no guild or channel IDs needed
-   **Development Safety**: `ALLOWED_GUILD_IDS` available for testing but discouraged in production
-   **Automated Discovery**: Intelligent channel discovery adapts to any server layout
-   **Built-in Safety**: Multiple layers of spam prevention and permission validation
-   **Horizontal Scaling**: Performance remains stable as the bot joins more guilds

### Environment Configuration

**Production (Recommended):**
```bash
DISCORD_TOKEN=your_bot_token_here
QUOTES_FILE=data/quotes.yaml
# ALLOWED_GUILD_IDS not set - operates on all guilds safely
```

**Development/Testing:**
```bash
DISCORD_TOKEN=your_bot_token_here
QUOTES_FILE=data/quotes.yaml
ALLOWED_GUILD_IDS=1105309398705897633  # Restrict to test guild
```

This design makes the bot immediately deployable across multiple Discord servers while maintaining the highest standards of safety and reliability.