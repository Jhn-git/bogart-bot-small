import { WanderingService } from '../wandering.service';
import { DiscordService } from '../discord.service';
import { QuoteService } from '../quote.service';
import { ConfigService } from '../config.service';
import { Client, Guild, Collection, TextChannel } from 'discord.js';

jest.mock('../discord.service');
jest.mock('../quote.service');
jest.mock('../config.service');

describe('WanderingService', () => {
  let wanderingService: WanderingService;
  let discordService: jest.Mocked<DiscordService>;
  let quoteService: jest.Mocked<QuoteService>;
  let configService: jest.Mocked<ConfigService>;
  let mockClient: jest.Mocked<Client>;

  beforeEach(() => {
    mockClient = {
      guilds: {
        cache: new Collection<string, Guild>(),
      },
      isReady: jest.fn(),
    } as any;

    configService = new (ConfigService as any)();
    discordService = new (DiscordService as any)(configService);
    (discordService.getClient as jest.Mock).mockReturnValue(mockClient);
    quoteService = new (QuoteService as any)(configService);

    wanderingService = new WanderingService(
      discordService,
      quoteService,
      configService,
    );
  });

  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('should send wandering messages to all guilds and channels', async () => {
    // Create mock channels that are instances of TextChannel
    const mockChannel1 = Object.create(TextChannel.prototype);
    Object.assign(mockChannel1, { id: '1', name: 'channel1' });
    
    const mockChannel2 = Object.create(TextChannel.prototype);
    Object.assign(mockChannel2, { id: '2', name: 'channel2' });

    const mockGuild1 = {
      name: 'guild1',
      channels: {
        cache: new Collection<string, TextChannel>([
          ['1', mockChannel1],
        ]),
      },
    };
    const mockGuild2 = {
      name: 'guild2',
      channels: {
        cache: new Collection<string, TextChannel>([
          ['2', mockChannel2],
        ]),
      },
    };
    mockClient.guilds.cache.set('g1', mockGuild1 as any);
    mockClient.guilds.cache.set('g2', mockGuild2 as any);
    mockClient.isReady.mockReturnValue(true);

    (quoteService.getWanderingMessage as jest.Mock).mockImplementation(
      (channelName) => `message for ${channelName}`,
    );

    wanderingService.start();

    // Fast-forward time by 12 hours
    jest.advanceTimersByTime(12 * 60 * 60 * 1000);

    // Allow promises to resolve
    await jest.runOnlyPendingTimersAsync();

    expect(discordService.sendMessage).toHaveBeenCalledWith(
      '1',
      'message for channel1',
    );
    expect(discordService.sendMessage).toHaveBeenCalledWith(
      '2',
      'message for channel2',
    );
  }, 10000);
});