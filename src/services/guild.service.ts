// src/services/guild.service.ts

import { Client, Guild } from 'discord.js';
import { DiscordService } from './discord.service';

export class GuildService {
  private discordService: DiscordService;
  private allowedGuildIds: string[] = [];

  constructor(discordService: DiscordService) {
    this.discordService = discordService;
    // Initialize allowed guild IDs from environment variable or config
    this.initializeAllowedGuilds();
  }

  private initializeAllowedGuilds(): void {
    // Get allowed guild IDs from environment variable (for development/testing only)
    const allowedGuilds = process.env.ALLOWED_GUILD_IDS;
    if (allowedGuilds) {
      this.allowedGuildIds = allowedGuilds.split(',').map(id => id.trim());
      console.log(`🚧 GuildService initialized with ${this.allowedGuildIds.length} allowed guild(s) (DEVELOPMENT MODE ONLY)`);
      console.log(`🚧 For production deployment, remove ALLOWED_GUILD_IDS from environment variables`);
    } else {
      // Production mode: operate on all guilds with intelligent spam prevention
      this.allowedGuildIds = [];
      console.log(`🚀 GuildService initialized for multi-guild operation (PRODUCTION MODE)`);
    }
  }

  /**
   * Returns all guilds the bot is currently in (filtered by allowed guilds if configured).
   */
  public getAllGuilds(): Guild[] {
    const client = this.discordService.getClient();
    const allGuilds = Array.from(client.guilds.cache.values());
    
    // If no allowed guilds specified, return all
    if (this.allowedGuildIds.length === 0) {
      return allGuilds;
    }

    // Filter to only allowed guilds
    const allowedGuilds = allGuilds.filter(guild => this.allowedGuildIds.includes(guild.id));
    console.log(`Filtered to ${allowedGuilds.length} allowed guild(s) out of ${allGuilds.length} total`);
    return allowedGuilds;
  }

  /**
   * Finds a guild by its ID (only if it's in the allowed list).
   */
  public getGuildById(guildId: string): Guild | undefined {
    // Check if guild is allowed
    if (this.allowedGuildIds.length > 0 && !this.allowedGuildIds.includes(guildId)) {
      console.warn(`Guild ${guildId} is not in the allowed list`);
      return undefined;
    }

    const client = this.discordService.getClient();
    return client.guilds.cache.get(guildId);
  }

  /**
   * Discovers guilds dynamically (filtered by allowed guilds).
   */
  public discoverGuilds(): Guild[] {
    return this.getAllGuilds();
  }

  /**
   * Checks if a guild is allowed for bot operations.
   */
  public isGuildAllowed(guildId: string): boolean {
    return this.allowedGuildIds.length === 0 || this.allowedGuildIds.includes(guildId);
  }

  /**
   * Gets the list of allowed guild IDs.
   */
  public getAllowedGuildIds(): string[] {
    return [...this.allowedGuildIds];
  }

  /**
   * Send a message to a specific channel
   */
  public async sendMessageToChannel(channelId: string, message: string): Promise<boolean> {
    try {
      const client = this.discordService.getClient();
      const channel = await client.channels.fetch(channelId);
      
      if (!channel || !channel.isTextBased() || channel.isDMBased()) {
        console.log(`GuildService: Channel ${channelId} is not a guild text channel`);
        return false;
      }
      
      await channel.send(message);
      return true;
    } catch (error) {
      console.error(`GuildService: Failed to send message to channel ${channelId}:`, error);
      return false;
    }
  }
}