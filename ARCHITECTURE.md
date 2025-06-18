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

## 3. Security and Bug Prevention

The new architecture directly addresses the previous mass-messaging bug. Here’s how:

-   **Guild Isolation**: The core logic now iterates through each guild one by one. The channel discovery and message sending processes are scoped to the current guild in the iteration. This makes it impossible for the bot to accidentally fetch channels from one guild and send a message to another.
-   **Removal of Global Configuration**: By removing `GUILD_ID` and `WANDERING_CHANNEL_IDS`, we have eliminated the single point of failure. The bot no longer relies on a static, hardcoded configuration that could be misconfigured.
-   **Strict Permission Checks**: The bot will not attempt to operate in any channel where it lacks explicit permissions. This prevents errors and ensures the bot behaves as expected by server administrators.
-   **Rate Limiting**: The bot respects Discord's rate limits to prevent spamming and ensure it is not kicked from servers for abusive behavior.

## 4. Zero-Configuration Setup

The primary goal of this redesign was to simplify the setup process. Server owners can now invite the bot and have it work immediately, with no extra steps.

-   **No IDs Required**: The removal of `GUILD_ID` and `WANDERING_CHANNEL_IDS` from the `.env` file means the only required variable is the `DISCORD_TOKEN`.
-   **Automated Discovery**: The bot handles channel selection automatically, adapting to any server's layout and permissions.

This streamlined setup process makes the bot more accessible and user-friendly, while the robust backend architecture ensures it is more reliable and secure than ever before.