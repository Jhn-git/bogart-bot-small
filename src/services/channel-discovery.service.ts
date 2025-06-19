// src/services/channel-discovery.service.ts

import { Guild, TextChannel, PermissionsBitField, ChannelType } from 'discord.js';
import { ConfigService } from './config.service';

export class ChannelDiscoveryService {
  private specialChannelNames: string[] = [];

  constructor(private configService: ConfigService) {
    this.loadSpecialChannelNames();
  }

  private loadSpecialChannelNames(): void {
    const quotesConfig = this.configService.get('quotes');
    if (quotesConfig && quotesConfig.goblin_wandering_messages) {
      this.specialChannelNames = Object.keys(quotesConfig.goblin_wandering_messages);
    }
  }

  /**
   * Returns a list of eligible text channels for messaging in a guild.
   * Applies naming patterns, permission checks, and channel type validation.
   */
  public discoverEligibleChannels(guild: Guild): TextChannel[] {
    try {
      return guild.channels.cache
        .filter(
          (channel) =>
            channel.type === ChannelType.GuildText &&
            this.isChannelEligible(channel as TextChannel)
        )
        .map((channel) => channel as TextChannel);
    } catch (error) {
      console.error(`Error discovering channels in guild ${guild.name} (${guild.id}):`, error);
      return [];
    }
  }

  /**
   * Determines if a channel is eligible for bot messaging.
   * - Checks for send permissions
   * - Filters out NSFW channels
   * - Applies naming pattern (e.g., contains 'general', 'bot', or 'chat')
   */
  private isChannelEligible(channel: TextChannel): boolean {
    try {
      // Permission: Bot must be able to send messages
      const permissions = channel.permissionsFor(channel.guild.members.me!);
      if (!permissions?.has(PermissionsBitField.Flags.SendMessages)) {
        return false;
      }

      // NSFW filter
      if (channel.nsfw) {
        return false;
      }

      // Naming pattern (customize as needed)
      const name = channel.name.toLowerCase();
      const allowedPatterns = ['general', 'bot', 'chat', 'talk', 'quotes'];
      const isAllowed =
        allowedPatterns.some((pattern) => name.includes(pattern)) ||
        this.specialChannelNames.includes(name);

      if (!isAllowed) {
        return false;
      }

      return true;
    } catch (error) {
      console.warn(`Error checking channel eligibility for ${channel.name} (${channel.id}):`, error);
      return false;
    }
  }
}