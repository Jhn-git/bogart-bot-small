import { WanderingService } from '../wandering.service';
import { DiscordService } from '../../../services/discord.service';
import { QuoteService } from '../../../services/quote.service';
import { GuildService } from '../../../services/guild.service';
import { ChannelDiscoveryService } from '../../../services/channel-discovery.service';
import { ConfigService } from '../../../services/config.service';
import { Client } from 'discord.js';
import { createMockDatabaseService } from '../../../../tests/helpers/mocks';

jest.useFakeTimers();

// Mock services
jest.mock('../../../services/discord.service');
jest.mock('../../../services/quote.service');
jest.mock('../../../services/guild.service');
jest.mock('../../../services/channel-discovery.service');

// Remove fs mocks, use DB mocks

describe('WanderingService', () => {
  let wanderingService: WanderingService;
  let mockDb: ReturnType<typeof createMockDatabaseService>;
  let mockDiscordService: jest.Mocked<DiscordService>;
  let mockQuoteService: jest.Mocked<QuoteService>;
  let mockGuildService: jest.Mocked<GuildService>;
  let mockChannelDiscoveryService: jest.Mocked<ChannelDiscoveryService>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockClient: jest.Mocked<Client>;

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    mockDb = createMockDatabaseService();
    mockDiscordService = new DiscordService({} as any, mockDb) as jest.Mocked<DiscordService>;
    mockQuoteService = new QuoteService({} as any) as jest.Mocked<QuoteService>;
    mockGuildService = new GuildService({} as any) as jest.Mocked<GuildService>;
    mockChannelDiscoveryService = new ChannelDiscoveryService({} as any) as jest.Mocked<ChannelDiscoveryService>;
    mockConfigService = { get: jest.fn().mockReturnValue(0) } as any;
    mockClient = { isReady: jest.fn().mockReturnValue(true) } as any;
    mockDiscordService.getClient.mockReturnValue(mockClient);
    wanderingService = new WanderingService(
      mockDb,
      mockQuoteService,
      mockGuildService,
      mockChannelDiscoveryService,
      mockConfigService
    );
  });

  it('should initialize and load cooldowns from DB', async () => {
    await (wanderingService as any).loadCooldowns();
    expect(mockDb.all).toHaveBeenCalledWith('SELECT guildId, timestamp FROM wandering_cooldowns');
  });

  // ...more tests as needed, mocking DB instead of fs...
});
