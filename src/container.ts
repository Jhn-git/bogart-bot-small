import { ConfigService } from './services/config.service';
import { DiscordService } from './services/discord.service';
import { QuoteService } from './services/quote.service';
import { WanderingService } from './services/wandering.service';
import { GuildService } from './services/guild.service';
import { ChannelDiscoveryService } from './services/channel-discovery.service';
import { MessageCleanupService } from './services/message-cleanup.service';

class Container {
  public readonly configService: ConfigService;
  public readonly quoteService: QuoteService;
  public readonly discordService: DiscordService;
  public readonly guildService: GuildService;
  public readonly channelDiscoveryService: ChannelDiscoveryService;
public readonly messageCleanupService: MessageCleanupService;
  public readonly wanderingService: WanderingService;

  constructor() {
    // Independent services
    this.configService = new ConfigService();
    this.quoteService = new QuoteService(this.configService);

    // Dependent services
    this.discordService = new DiscordService(this.configService);
    this.guildService = new GuildService(this.discordService);
    this.channelDiscoveryService = new ChannelDiscoveryService();
    this.wanderingService = new WanderingService(
      this.discordService,
      this.quoteService,
      this.guildService,
      this.channelDiscoveryService,
    );
    this.messageCleanupService = new MessageCleanupService(this.discordService, this.configService, this.guildService);
  }
}

const container = new Container();
export default container;