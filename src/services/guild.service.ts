// src/services/guild.service.ts

import { Client, Guild } from 'discord.js';
import { DiscordService } from './discord.service';

export class GuildService {
  private discordService: DiscordService;

  constructor(discordService: DiscordService) {
    this.discordService = discordService;
  }

  /**
   * Returns all guilds the bot is currently in.
   */
  public getAllGuilds(): Guild[] {
    const client = this.discordService.getClient();
    return Array.from(client.guilds.cache.values());
  }

  /**
   * Finds a guild by its ID.
   */
  public getGuildById(guildId: string): Guild | undefined {
    const client = this.discordService.getClient();
    return client.guilds.cache.get(guildId);
  }

  /**
   * Discovers guilds dynamically (future: can add filtering, etc).
   */
  public discoverGuilds(): Guild[] {
    // For now, just return all guilds.
    return this.getAllGuilds();
  }
}