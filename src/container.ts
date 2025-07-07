import { ConfigService } from './services/config.service';
import { DiscordService } from './services/discord.service';
import { QuoteService } from './services/quote.service';
import { GuildService } from './services/guild.service';
import { ChannelDiscoveryService } from './services/channel-discovery.service';
import { MessageCleanupService } from './services/message-cleanup.service';
import { StatusService } from './services/status.service';
import { NotificationService } from './services/notification.service';
import { DatabaseService } from './services/database.service';
import { CommandService } from './services/command.service';

class Container {
  public readonly configService: ConfigService;
  public readonly quoteService: QuoteService;
  public readonly discordService: DiscordService;
  public readonly guildService: GuildService;
  public readonly channelDiscoveryService: ChannelDiscoveryService;
  public readonly messageCleanupService: MessageCleanupService;
  public readonly statusService: StatusService;
  public readonly notificationService: NotificationService;
  public readonly databaseService: DatabaseService;
  public readonly commandService: CommandService;
  private registry: Map<string, any> = new Map();

  constructor() {
    // Independent services
    this.configService = new ConfigService();
    this.quoteService = new QuoteService(this.configService);
    this.databaseService = new DatabaseService();

    // Dependent services
    this.discordService = new DiscordService(this.configService, this.databaseService);
    this.guildService = new GuildService(this.discordService);
    this.channelDiscoveryService = new ChannelDiscoveryService(this.configService);
    this.statusService = new StatusService(this.discordService);
    this.notificationService = new NotificationService(
      this.discordService,
      this.channelDiscoveryService,
      this.configService
    );
    this.messageCleanupService = new MessageCleanupService(this.discordService, this.configService, this.guildService);
    this.commandService = new CommandService(
      this.discordService.getClient(),
      this.configService,
      this.databaseService,
      this.guildService
    );
    
    // Wire up services to discord service
    this.discordService.setStatusService(this.statusService);
    this.discordService.setNotificationService(this.notificationService);
    this.discordService.setCommandService(this.commandService);
  }

  // Add a method to allow dynamic registration of services
  register(name: string, factory: (c: Container) => any) {
    this.registry.set(name, factory);
  }

  // Add a method to directly expose services to the container
  registerDirectly(name: string, factory: (c: Container) => any) {
    const service = factory(this);
    (this as any)[name] = service;
    return service;
  }

  resolve<T>(name: string): T {
    if (!this.registry.has(name)) throw new Error(`Service not registered: ${name}`);
    return this.registry.get(name)(this);
  }
}

const container = new Container();
export default container;