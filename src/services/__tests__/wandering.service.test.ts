import { WanderingService } from '../wandering.service';
import {
  mockDiscordService,
  mockQuoteService,
  mockConfigService,
  mockClient,
  createMockTextChannel,
} from '../../__tests__/mocks';
import { Collection, Guild } from 'discord.js';

jest.unmock('../wandering.service');

describe('WanderingService', () => {
  let wanderingService: WanderingService;

  beforeEach(() => {
    wanderingService = new WanderingService(
      mockDiscordService,
      mockQuoteService,
      mockConfigService,
    );
  });

  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('should send wandering messages to all guilds and channels', async () => {
    const mockChannel1 = createMockTextChannel('1', 'channel1');
    const mockChannel2 = createMockTextChannel('2', 'channel2');

    const mockGuild1 = {
      name: 'guild1',
      channels: {
        cache: new Collection([['1', mockChannel1]]),
      },
    };
    const mockGuild2 = {
      name: 'guild2',
      channels: {
        cache: new Collection([['2', mockChannel2]]),
      },
    };
    mockClient.guilds.cache.set('g1', mockGuild1 as Guild);
    mockClient.guilds.cache.set('g2', mockGuild2 as Guild);

    (mockQuoteService.getWanderingMessage as jest.Mock).mockImplementation(
      (channelName) => `message for ${channelName}`,
    );

    wanderingService.start();

    // Fast-forward time by 12 hours
    jest.advanceTimersByTime(12 * 60 * 60 * 1000);

    // Allow promises to resolve
    await jest.runOnlyPendingTimersAsync();

    expect(mockDiscordService.sendMessage).toHaveBeenCalledWith(
      '1',
      'message for channel1',
    );
    expect(mockDiscordService.sendMessage).toHaveBeenCalledWith(
      '2',
      'message for channel2',
    );
  }, 10000);
});