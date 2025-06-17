import { TextChannel } from 'discord.js';
import { DiscordService } from './discord.service';
import { QuoteService } from './quote.service';
import { ConfigService } from './config.service';

const WANDERING_INTERVAL = 12 * 60 * 60 * 1000; // 12 hours

export class WanderingService {
  private discordService: DiscordService;
  private quoteService: QuoteService;
  private configService: ConfigService;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(
    discordService: DiscordService,
    quoteService: QuoteService,
    configService: ConfigService,
  ) {
    this.discordService = discordService;
    this.quoteService = quoteService;
    this.configService = configService;
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

    for (const guild of client.guilds.cache.values()) {
      for (const channel of guild.channels.cache.values()) {
        if (channel instanceof TextChannel) {
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
}
