import { TextChannel } from 'discord.js';
import { DiscordService } from './discord.service';
import { QuoteService } from './quote.service';
import { GuildService } from './guild.service';
import { ChannelDiscoveryService } from './channel-discovery.service';

const WANDERING_INTERVAL = 12 * 60 * 60 * 1000; // 12 hours
const PER_GUILD_RATE_LIMIT = 6 * 60 * 60 * 1000; // 6 hours per guild
const TIMESTAMP_CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours - cleanup old timestamps
const TIMESTAMP_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days - max age for stored timestamps

export class WanderingService {
  private discordService: DiscordService;
  private quoteService: QuoteService;
  private guildService: GuildService;
  private channelDiscoveryService: ChannelDiscoveryService;
  private intervalId: NodeJS.Timeout | null = null;
  private cleanupIntervalId: NodeJS.Timeout | null = null;
  private lastMessageTimestamps: Map<string, number> = new Map();

  constructor(
    discordService: DiscordService,
    quoteService: QuoteService,
    guildService: GuildService,
    channelDiscoveryService: ChannelDiscoveryService,
  ) {
    this.discordService = discordService;
    this.quoteService = quoteService;
    this.guildService = guildService;
    this.channelDiscoveryService = channelDiscoveryService;
  }

  public start(): void {
    if (this.intervalId) {
      console.log('WanderingService is already running');
      return;
    }

    console.log(`Starting WanderingService with ${WANDERING_INTERVAL / 1000 / 60 / 60} hour interval`);
    this.intervalId = setInterval(() => this.sendWanderingMessages(), WANDERING_INTERVAL);
    
    // Start timestamp cleanup interval to prevent memory leaks
    this.cleanupIntervalId = setInterval(() => this.cleanupOldTimestamps(), TIMESTAMP_CLEANUP_INTERVAL);
  }

  public stop(): void {
    if (this.intervalId) {
      console.log('Stopping WanderingService...');
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
  }

  private async sendWanderingMessages(): Promise<void> {
    const client = this.discordService.getClient();
    if (!client.isReady()) {
      return;
    }

    const now = Date.now();
    const guilds = this.guildService.getAllGuilds();
    for (const guild of guilds) {
      // Per-guild rate limiting
      const lastSent = this.lastMessageTimestamps.get(guild.id) || 0;
      if (now - lastSent < PER_GUILD_RATE_LIMIT) {
        continue;
      }

      const eligibleChannels = this.channelDiscoveryService.discoverEligibleChannels(guild);
      if (eligibleChannels.length > 0) {
        // Shuffle channels for smarter selection
        const shuffled = eligibleChannels
          .map(value => ({ value, sort: Math.random() }))
          .sort((a, b) => a.sort - b.sort)
          .map(({ value }) => value);

        const channel = shuffled[0];
        const message = this.quoteService.getWanderingMessage(channel.name);
        if (message) {
          const success = await this.discordService.sendMessage(channel.id, message);
          if (success) {
            this.lastMessageTimestamps.set(guild.id, now);
          } else {
            console.warn(
              `Could not send wandering message to ${channel.name} in ${guild.name}`,
            );
          }
        }
      }
    }
  }

  /**
   * Cleanup old timestamps to prevent memory leaks
   */
  private cleanupOldTimestamps(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    for (const [guildId, timestamp] of this.lastMessageTimestamps.entries()) {
      if (now - timestamp > TIMESTAMP_MAX_AGE) {
        expiredKeys.push(guildId);
      }
    }
    
    for (const key of expiredKeys) {
      this.lastMessageTimestamps.delete(key);
    }
    
    if (expiredKeys.length > 0) {
      console.log(`WanderingService: Cleaned up ${expiredKeys.length} old timestamp entries`);
    }
  }

}
