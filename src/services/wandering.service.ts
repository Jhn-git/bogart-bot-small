import { TextChannel } from 'discord.js';
import { DiscordService } from './discord.service';
import { QuoteService } from './quote.service';
import { GuildService } from './guild.service';
import { ChannelDiscoveryService } from './channel-discovery.service';

const WANDERING_INTERVAL = 12 * 60 * 60 * 1000; // 12 hours

export class WanderingService {
  private discordService: DiscordService;
  private quoteService: QuoteService;
  private guildService: GuildService;
  private channelDiscoveryService: ChannelDiscoveryService;
  private intervalId: NodeJS.Timeout | null = null;

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

    const guilds = this.guildService.getAllGuilds();
    for (const guild of guilds) {
      const eligibleChannels = this.channelDiscoveryService.discoverEligibleChannels(guild);
      if (eligibleChannels.length > 0) {
        const channel = eligibleChannels[Math.floor(Math.random() * eligibleChannels.length)];
        const message = this.quoteService.getWanderingMessage(channel.name);
        if (message) {
          try {
            await this.discordService.sendMessage(channel.id, message);
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
