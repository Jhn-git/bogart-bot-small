import { ConfigService } from './services/config.service';
import { DiscordService } from './services/discord.service';
import { QuoteService } from './services/quote.service';
import { WanderingService } from './services/wandering.service';

class Container {
  public readonly configService: ConfigService;
  public readonly quoteService: QuoteService;
  public readonly discordService: DiscordService;
  public readonly wanderingService: WanderingService;

  constructor() {
    // Independent services
    this.configService = new ConfigService();
    this.quoteService = new QuoteService(this.configService);

    // Dependent services
    this.discordService = new DiscordService(this.configService);
    this.wanderingService = new WanderingService(
      this.discordService,
      this.quoteService,
      this.configService,
    );
  }
}

const container = new Container();
export default container;