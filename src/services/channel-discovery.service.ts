// src/services/channel-discovery.service.ts

import { Guild, TextChannel, PermissionsBitField, ChannelType } from 'discord.js';

export class ChannelDiscoveryService {
  /**
   * Returns a list of eligible text channels for messaging in a guild.
   * Applies naming patterns, permission checks, and channel type validation.
   */
  public discoverEligibleChannels(guild: Guild): TextChannel[] {
    return guild.channels.cache
      .filter(
        (channel) =>
          channel.type === ChannelType.GuildText &&
          this.isChannelEligible(channel as TextChannel)
      )
      .map((channel) => channel as TextChannel);
  }

  /**
   * Determines if a channel is eligible for bot messaging.
   * - Checks for send permissions
   * - Filters out NSFW channels
   * - Applies naming pattern (e.g., contains 'general', 'bot', or 'chat')
   */
  private isChannelEligible(channel: TextChannel): boolean {
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
    if (!allowedPatterns.some((pattern) => name.includes(pattern))) {
      return false;
    }

    return true;
  }
}