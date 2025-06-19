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
   * - Checks for send permissions and read message history
   * - Filters out NSFW channels
   * - Uses blacklist approach: blocks problematic channels, allows most others
   */
  private isChannelEligible(channel: TextChannel): boolean {
    try {
      // Permission: Bot must be able to view channel, send messages and read message history
      const permissions = channel.permissionsFor(channel.guild.members.me!);
      if (!permissions?.has(PermissionsBitField.Flags.ViewChannel) ||
          !permissions?.has(PermissionsBitField.Flags.SendMessages) ||
          !permissions?.has(PermissionsBitField.Flags.ReadMessageHistory)) {
        // Only log permission issues in development/production, not during tests
        if (process.env.NODE_ENV !== 'test') {
          console.log(`⚠️  Channel ${channel.name} in ${channel.guild.name}: Missing permissions (ViewChannel: ${permissions?.has(PermissionsBitField.Flags.ViewChannel)}, SendMessages: ${permissions?.has(PermissionsBitField.Flags.SendMessages)}, ReadMessageHistory: ${permissions?.has(PermissionsBitField.Flags.ReadMessageHistory)})`);
        }
        return false;
      }

      // NSFW filter
      if (channel.nsfw) {
        return false;
      }

      // Blacklist approach: Block problematic channel patterns
      const name = channel.name.toLowerCase();
      const blockedPatterns = [
        // Administrative channels (exact matches or word boundaries)
        'rules', 'rule', 'announcement', 'announcements', 'welcome', 'info', 'guidelines',
        // Staff channels
        'mod-', 'moderator', 'admin-', 'administrator', 'staff-', 'mods-', 'admins-',
        // Sensitive/serious channels
        'vent', 'venting', 'serious', 'support', 'help', 'confession', 'confessions',
        // Specialized channels that might not welcome random messages
        'art-', 'showcase', 'feedback', 'suggestion', 'suggestions', 'bug-', 'report-'
      ];

      const isBlocked = blockedPatterns.some((pattern) => name.includes(pattern));
      if (isBlocked) {
        return false;
      }

      // Special allowlist for quote-specific channels (from YAML config)
      const isSpecialChannel = this.specialChannelNames.includes(name);
      if (isSpecialChannel) {
        return true; // Always allow special channels from config
      }

      // Check for obvious conversation channels (these get priority)
      const conversationPatterns = [
        'general', 'chat', 'talk', 'random', 'off-topic', 'offtopic', 'casual', 
        'lounge', 'hangout', 'social', 'community', 'discussion', 'misc', 'miscellaneous'
      ];
      
      const isConversationChannel = conversationPatterns.some((pattern) => name.includes(pattern));
      
      // Allow conversation channels and any other channel not explicitly blocked
      return true;
    } catch (error) {
      console.warn(`Error checking channel eligibility for ${channel.name} (${channel.id}):`, error);
      return false;
    }
  }
}