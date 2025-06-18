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

    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    const deleted: MessageCleanupLog[] = [];
    const errors: MessageCleanupLog[] = [];
    let totalScanned = 0;
    let totalMatched = 0;

    const allowedGuilds = this.guildService.getAllGuilds();
    console.log(`MessageCleanupService: Operating on ${allowedGuilds.length} allowed guild(s)`);
    
    for (const guild of allowedGuilds) {
      for (const channel of guild.channels.cache.values()) {
        if (channel.type !== ChannelType.GuildText) continue;
        const textChannel = channel as TextChannel;
        const permissions = textChannel.permissionsFor(botId);
        if (!textChannel.viewable || !permissions || !permissions.has('ManageMessages')) {
          errors.push({
            guildId: guild.id,
            channelId: channel.id,
            messageId: null,
            action: 'skip',
            reason: 'Missing permissions or not viewable',
          });
          continue;
        }

        let lastId: Snowflake | undefined = undefined;
        let done = false;
        while (!done) {
          try {
            const messages: Collection<string, Message> = await textChannel.messages.fetch({ limit: batchSize, before: lastId });
            if (messages.size === 0) break;
            const toDelete = messages.filter(
              (msg: Message) =>
                msg.author.id === botId &&
                msg.createdTimestamp >= cutoff
            );
            totalScanned += messages.size;
            totalMatched += toDelete.size;

            if (logProgress) {
              console.log(`[${guild.name}#${textChannel.name}] Scanned: ${totalScanned}, Matched: ${totalMatched}`);
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
                } catch (err: any) {
                  errors.push({
                    guildId: guild.id,
                    channelId: textChannel.id,
                    messageId: msg.id,
                    action: 'error',
                    reason: err.message || 'Unknown error',
                  });
                }
              }
            }
            lastId = messages.last()?.id;
            if (messages.size < batchSize) done = true;
          } catch (err: any) {
            errors.push({
              guildId: guild.id,
              channelId: channel.id,
              messageId: null,
              action: 'error',
              reason: err.message || 'Fetch error',
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

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}