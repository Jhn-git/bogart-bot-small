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
      const isDebugMode = process.env.NODE_ENV !== 'test' && process.env.LOG_LEVEL === 'debug';
      
      if (isDebugMode) {
        console.log(`[Discovery] Starting channel discovery for guild ${guild.name} (${guild.id})`);
      }
      
      const allChannels = guild.channels.cache;
      const textChannels = allChannels.filter(channel => channel.type === ChannelType.GuildText);
      
      if (isDebugMode) {
        console.log(`[Discovery] Found ${textChannels.size} text channels out of ${allChannels.size} total channels`);
      }
      
      const eligibleChannels: TextChannel[] = [];
      
      for (const [channelId, channel] of textChannels) {
        const textChannel = channel as TextChannel;
        const isEligible = this.isChannelEligible(textChannel);
        
        if (isEligible) {
          eligibleChannels.push(textChannel);
        }
      }
      
      if (isDebugMode) {
        console.log(`[Discovery] Result: ${eligibleChannels.length} eligible channels found`);
        if (eligibleChannels.length > 0) {
          console.log(`[Discovery] Eligible channels: ${eligibleChannels.map(ch => `#${ch.name}`).join(', ')}`);
        }
      }
      
      return eligibleChannels;
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
      const isDebugMode = process.env.NODE_ENV !== 'test' && process.env.LOG_LEVEL === 'debug';
      
      if (isDebugMode) {
        console.log(`[Discovery] Checking channel #${channel.name} (ID: ${channel.id})...`);
      }

      // Check if it's a text channel (should always be true since we filter before calling this)
      if (isDebugMode) {
        console.log(`[Discovery] -> Is Text Channel? ✅ Yes.`);
      }

      // Permission: Bot must be able to view channel, send messages and read message history
      const permissions = channel.permissionsFor(channel.guild.members.me!);
      const hasViewChannel = permissions?.has(PermissionsBitField.Flags.ViewChannel) || false;
      const hasSendMessages = permissions?.has(PermissionsBitField.Flags.SendMessages) || false;
      const hasReadHistory = permissions?.has(PermissionsBitField.Flags.ReadMessageHistory) || false;
      
      if (isDebugMode) {
        console.log(`[Discovery] -> Has View Channel Perm? ${hasViewChannel ? '✅' : '❌'} ${hasViewChannel ? 'Yes' : 'No'}.`);
        console.log(`[Discovery] -> Has Send Messages Perm? ${hasSendMessages ? '✅' : '❌'} ${hasSendMessages ? 'Yes' : 'No'}.`);
        console.log(`[Discovery] -> Has Read History Perm? ${hasReadHistory ? '✅' : '❌'} ${hasReadHistory ? 'Yes' : 'No'}.`);
      }
      
      if (!hasViewChannel || !hasSendMessages || !hasReadHistory) {
        if (isDebugMode) {
          console.log(`[Discovery] --> Channel #${channel.name} is INELIGIBLE (missing permissions).`);
        }
        return false;
      }

      // NSFW filter
      if (isDebugMode) {
        console.log(`[Discovery] -> Is NSFW? ${channel.nsfw ? '❌' : '✅'} ${channel.nsfw ? 'Yes (blocked)' : 'No'}.`);
      }
      if (channel.nsfw) {
        if (isDebugMode) {
          console.log(`[Discovery] --> Channel #${channel.name} is INELIGIBLE (NSFW).`);
        }
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

      const blockedPattern = blockedPatterns.find((pattern) => name.includes(pattern));
      const isBlocked = !!blockedPattern;
      
      if (isDebugMode) {
        console.log(`[Discovery] -> Passes Blacklist Check? ${isBlocked ? '❌' : '✅'} ${isBlocked ? `No (keyword: '${blockedPattern}')` : 'Yes'}.`);
      }
      
      if (isBlocked) {
        if (isDebugMode) {
          console.log(`[Discovery] --> Channel #${channel.name} is INELIGIBLE (blacklisted pattern: '${blockedPattern}').`);
        }
        return false;
      }

      // Special allowlist for quote-specific channels (from YAML config)
      const isSpecialChannel = this.specialChannelNames.includes(name);
      if (isDebugMode) {
        console.log(`[Discovery] -> Is Special Channel? ${isSpecialChannel ? '✅' : '❌'} ${isSpecialChannel ? 'Yes (from config)' : 'No'}.`);
      }
      
      if (isSpecialChannel) {
        if (isDebugMode) {
          console.log(`[Discovery] --> Channel #${channel.name} is ELIGIBLE (special channel from config).`);
        }
        return true; // Always allow special channels from config
      }

      // Check for obvious conversation channels (these get priority)
      const conversationPatterns = [
        'general', 'chat', 'talk', 'random', 'off-topic', 'offtopic', 'casual',
        'lounge', 'hangout', 'social', 'community', 'discussion', 'misc', 'miscellaneous'
      ];
      const allowedPatterns = ['bot-commands'];
      
      const conversationPattern = conversationPatterns.find((pattern) => name.includes(pattern));
      const isConversationChannel = !!conversationPattern;
      
      const allowedPattern = allowedPatterns.find((pattern) => name.includes(pattern));
      const isAllowedPattern = !!allowedPattern;
      
      if (isDebugMode) {
        console.log(`[Discovery] -> Is Conversation Channel? ${isConversationChannel ? '✅' : '❌'} ${isConversationChannel ? `Yes (pattern: '${conversationPattern}')` : 'No'}.`);
        console.log(`[Discovery] -> Is Allowed Pattern? ${isAllowedPattern ? '✅' : '❌'} ${isAllowedPattern ? `Yes (pattern: '${allowedPattern}')` : 'No'}.`);
      }

      // If it passes all the safety checks (permissions, not NSFW, not blacklisted), 
      // then it should be eligible unless it's a special restricted channel
      const finalResult = true; // Allow any channel that passes basic safety checks
      
      if (isDebugMode) {
        if (isSpecialChannel) {
          console.log(`[Discovery] --> Channel #${channel.name} is ELIGIBLE (special channel from config).`);
        } else if (isConversationChannel) {
          console.log(`[Discovery] --> Channel #${channel.name} is ELIGIBLE (conversation channel).`);
        } else if (isAllowedPattern) {
          console.log(`[Discovery] --> Channel #${channel.name} is ELIGIBLE (allowed pattern).`);
        } else {
          console.log(`[Discovery] --> Channel #${channel.name} is ELIGIBLE (passes all safety checks).`);
        }
      }

      return finalResult;
    } catch (error) {
      console.warn(`Error checking channel eligibility for ${channel.name} (${channel.id}):`, error);
      return false;
    }
  }
}