// MessageCleanupService for safe, controlled Discord message cleanup

import { Client, TextChannel, Message, Guild, ChannelType, Snowflake, Collection } from 'discord.js';
import { ConfigService } from './config.service';
import { DiscordService } from './discord.service';
import { GuildService } from './guild.service';
import { MessageCleanupOptions, MessageCleanupResult, MessageCleanupLog } from '../types';

export class MessageCleanupService {
  private client: Client;
  private configService: ConfigService;
  private guildService: GuildService;
  private botUserId: string | null = null;

  constructor(discordService: DiscordService, configService: ConfigService, guildService: GuildService) {
    this.client = discordService.getClient();
    this.configService = configService;
    this.guildService = guildService;
  }

  // Initialize and cache bot user ID
  public async init(): Promise<void> {
    if (!this.client.user) {
      throw new Error('Discord client not logged in.');
    }
    this.botUserId = this.client.user.id;
  }

  // Main cleanup method
  public async cleanupMessages(options: MessageCleanupOptions): Promise<MessageCleanupResult> {
    if (!this.botUserId) {
      await this.init();
    }

    if (!this.botUserId) {
      throw new Error('Bot user ID could not be initialized.');
    }
    const botId = this.botUserId;

  const {
    dryRun = true,
    confirm = false,
    hours = 48,
    batchSize = 50,
    rateLimitMs = 1200,
    logProgress = true,
  } = options;

  const maxMessagesPerChannel = this.configService.get('cleanupMaxMessages');

    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    const deleted: MessageCleanupLog[] = [];
    const errors: MessageCleanupLog[] = [];
    let totalScanned = 0;
    let totalMatched = 0;

    const allowedGuilds = this.guildService.getAllGuilds();
    console.log(`MessageCleanupService: Operating on ${allowedGuilds.length} allowed guild(s)`);
    console.log(`Bot ID: ${botId}`);
    console.log(`Cutoff time: ${new Date(cutoff).toISOString()}`);
    
    if (allowedGuilds.length === 0) {
      console.warn('❌ No guilds found for cleanup. Check bot permissions and guild membership.');
      return { scanned: 0, matched: 0, deleted: [], errors: [], dryRun, confirm };
    }
    
    for (const guild of allowedGuilds) {
      console.log(`\n🔍 Processing guild: ${guild.name} (${guild.id})`);
      
      // Ensure guild data is fully loaded
      try {
        await guild.fetch();
        await guild.channels.fetch();
        console.log(`   Guild data refreshed. Total channels: ${guild.channels.cache.size}`);
      } catch (error) {
        console.warn(`   ⚠️  Failed to fetch guild data: ${error}`);
        errors.push({
          guildId: guild.id,
          channelId: '',
          messageId: null,
          action: 'error',
          reason: `Failed to fetch guild data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
        continue;
      }
      
      // Pre-filter channels to only those we can actually process
      const eligibleChannels = this.getEligibleChannels(guild, botId);
      console.log(`Guild ${guild.name}: Processing ${eligibleChannels.length} eligible channels`);
      
      for (const textChannel of eligibleChannels) {
        let lastId: Snowflake | undefined = undefined;
        let done = false;
        let scannedThisChannel = 0;
        while (!done) {
          try {
            // Adjust fetch size if close to maxMessagesPerChannel
            const remaining = maxMessagesPerChannel - scannedThisChannel;
            if (remaining <= 0) break;
            const fetchLimit = Math.min(batchSize, remaining);

            const messages: Collection<string, Message> = await textChannel.messages.fetch({ limit: fetchLimit, before: lastId });
            if (messages.size === 0) break;
            const toDelete = messages.filter(
              (msg: Message) =>
                msg.author.id === botId &&
                msg.createdTimestamp >= cutoff
            );
            totalScanned += messages.size;
            scannedThisChannel += messages.size;
            totalMatched += toDelete.size;

            if (logProgress) {
              console.log(`[${guild.name}#${textChannel.name}] Scanned: ${totalScanned} (this channel: ${scannedThisChannel}/${maxMessagesPerChannel}), Matched: ${totalMatched}`);
            }

            for (const msg of toDelete.values()) {
              if (dryRun) {
                deleted.push({
                  guildId: guild.id,
                  channelId: textChannel.id,
                  messageId: msg.id,
                  action: 'dry-run',
                  reason: 'Would delete',
                });
              } else if (confirm) {
                try {
                  await msg.delete();
                  deleted.push({
                    guildId: guild.id,
                    channelId: textChannel.id,
                    messageId: msg.id,
                    action: 'deleted',
                    reason: '',
                  });
                  await this.delay(rateLimitMs);
                } catch (err: unknown) {
                  errors.push({
                    guildId: guild.id,
                    channelId: textChannel.id,
                    messageId: msg.id,
                    action: 'error',
                    reason: err instanceof Error ? err.message : 'Unknown error',
                  });
                }
              }
            }
            lastId = messages.last()?.id;
            if (messages.size < fetchLimit || scannedThisChannel >= maxMessagesPerChannel) done = true;
          } catch (err: unknown) {
            errors.push({
              guildId: guild.id,
              channelId: textChannel.id,
              messageId: null,
              action: 'error',
              reason: err instanceof Error ? err.message : 'Fetch error',
            });
            done = true;
          }
        }
      }
    }

    return {
      scanned: totalScanned,
      matched: totalMatched,
      deleted,
      errors,
      dryRun,
      confirm,
    };
  }

  /**
   * Pre-filter channels to only those eligible for message cleanup
   */
  private getEligibleChannels(guild: Guild, botId: string): TextChannel[] {
    const eligibleChannels: TextChannel[] = [];
    let textChannelCount = 0;
    let permissionDeniedCount = 0;
    let notViewableCount = 0;
    
    console.log(`   🔍 Checking channels in guild: ${guild.name}`);
    
    for (const channel of guild.channels.cache.values()) {
      if (channel.type !== ChannelType.GuildText) continue;
      
      textChannelCount++;
      const textChannel = channel as TextChannel;
      console.log(`     📝 Checking channel: #${textChannel.name} (${textChannel.id})`);
      
      try {
        const permissions = textChannel.permissionsFor(botId);
        const viewable = textChannel.viewable;
        const hasManageMessages = permissions && permissions.has('ManageMessages');
        
        console.log(`        Viewable: ${viewable}, Has ManageMessages: ${hasManageMessages}`);
        
        if (viewable && permissions && hasManageMessages) {
          eligibleChannels.push(textChannel);
          console.log(`        ✅ Channel eligible for cleanup`);
        } else {
          if (!viewable) notViewableCount++;
          if (!hasManageMessages) permissionDeniedCount++;
          console.log(`        ❌ Channel not eligible: viewable=${viewable}, manageMessages=${hasManageMessages}`);
        }
      } catch (error) {
        console.warn(`        ⚠️  Error checking permissions for channel ${textChannel.name} (${textChannel.id}):`, error);
      }
    }
    
    console.log(`   📊 Channel summary: ${textChannelCount} text channels, ${eligibleChannels.length} eligible, ${notViewableCount} not viewable, ${permissionDeniedCount} missing permissions`);
    
    return eligibleChannels;
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}