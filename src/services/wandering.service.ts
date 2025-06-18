import { TextChannel } from 'discord.js';
import { DiscordService } from './discord.service';
import { QuoteService } from './quote.service';
import { GuildService } from './guild.service';
import { ChannelDiscoveryService } from './channel-discovery.service';

const WANDERING_INTERVAL = 12 * 60 * 60 * 1000; // 12 hours
const PER_GUILD_RATE_LIMIT = 6 * 60 * 60 * 1000; // 6 hours per guild

export class WanderingService {
  private discordService: DiscordService;
  private quoteService: QuoteService;
  private guildService: GuildService;
  private channelDiscoveryService: ChannelDiscoveryService;
  private intervalId: NodeJS.Timeout | null = null;
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
  }

  public stop(): void {
    if (this.intervalId) {
      console.log('Stopping WanderingService...');
      clearInterval(this.intervalId);
      this.intervalId = null;
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
          try {
            await this.discordService.sendMessage(channel.id, message);
            this.lastMessageTimestamps.set(guild.id, now);
          } catch (error) {
            console.error(
              `Failed to send wandering message to ${channel.name} in ${guild.name}:`,
              error,
            );
          }
        }
      }
    }
  }

}
