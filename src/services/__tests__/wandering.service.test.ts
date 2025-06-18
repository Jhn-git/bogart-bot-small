// src/services/__tests__/wandering.service.test.ts

import { WanderingService } from '../wandering.service';
import { DiscordService } from '../discord.service';
import { QuoteService } from '../quote.service';
import { GuildService } from '../guild.service';
import { ChannelDiscoveryService } from '../channel-discovery.service';
import { ConfigService } from '../config.service';
import { Guild, TextChannel, Collection } from 'discord.js';
import { Client } from 'discord.js';

jest.useFakeTimers();

// Mock services
jest.mock('../discord.service');
jest.mock('../quote.service');
jest.mock('../guild.service');
jest.mock('../channel-discovery.service');

describe('WanderingService', () => {
  let wanderingService: WanderingService;
  let mockDiscordService: jest.Mocked<DiscordService>;
  let mockQuoteService: jest.Mocked<QuoteService>;
  let mockGuildService: jest.Mocked<GuildService>;
  let mockChannelDiscoveryService: jest.Mocked<ChannelDiscoveryService>;
  let mockClient: jest.Mocked<Client>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = {
      isReady: jest.fn().mockReturnValue(true),
    } as unknown as jest.Mocked<Client>;

    mockDiscordService = new DiscordService({} as any) as jest.Mocked<DiscordService>;
    mockDiscordService.getClient = jest.fn().mockReturnValue(mockClient);
    mockDiscordService.sendMessage = jest.fn().mockResolvedValue(undefined);

    mockQuoteService = new QuoteService({} as any) as jest.Mocked<QuoteService>;
    mockQuoteService.getWanderingMessage = jest.fn().mockReturnValue('A wandering message.');

    mockGuildService = new GuildService(mockDiscordService) as jest.Mocked<GuildService>;
    const mockConfigService = {} as any;
    mockChannelDiscoveryService = new ChannelDiscoveryService(mockConfigService) as jest.Mocked<ChannelDiscoveryService>;

    wanderingService = new WanderingService(
      mockDiscordService,
      mockQuoteService,
      mockGuildService,
      mockChannelDiscoveryService
    );
  });

  afterEach(() => {
    wanderingService.stop();
  });

  describe('sendWanderingMessages', () => {
    it('should send a message to only ONE eligible channel per guild', async () => {
      // Arrange
      const guild1 = { id: '1', name: 'Guild 1' } as Guild;
      const guild2 = { id: '2', name: 'Guild 2' } as Guild;
      const channels1 = [
        { id: 'c1', name: 'general' },
        { id: 'c2', name: 'chat' },
      ] as TextChannel[];
      const channels2 = [
        { id: 'c3', name: 'bot-stuff' },
        { id: 'c4', name: 'random' },
      ] as TextChannel[];

      mockGuildService.getAllGuilds.mockReturnValue([guild1, guild2]);
      mockChannelDiscoveryService.discoverEligibleChannels
        .mockReturnValueOnce(channels1)
        .mockReturnValueOnce(channels2);

      // Act
      wanderingService.start();
      await jest.advanceTimersByTimeAsync(12 * 60 * 60 * 1000); // 12 hours

      // Assert
      expect(mockDiscordService.sendMessage).toHaveBeenCalledTimes(2);
      // Check that a channel from guild 1 was called
      expect(channels1.some(c => mockDiscordService.sendMessage.mock.calls.some(call => call[0] === c.id))).toBe(true);
      // Check that a channel from guild 2 was called
      expect(channels2.some(c => mockDiscordService.sendMessage.mock.calls.some(call => call[0] === c.id))).toBe(true);
    });

    it('should not send messages if no guilds are found', async () => {
      mockGuildService.getAllGuilds.mockReturnValue([]);
      
      wanderingService.start();
      await jest.advanceTimersByTimeAsync(12 * 60 * 60 * 1000);

      expect(mockDiscordService.sendMessage).not.toHaveBeenCalled();
    });

    it('should not send messages to a guild with no eligible channels', async () => {
      const guild1 = { id: '1', name: 'Guild 1' } as Guild;
      mockGuildService.getAllGuilds.mockReturnValue([guild1]);
      mockChannelDiscoveryService.discoverEligibleChannels.mockReturnValue([]);

      wanderingService.start();
      await jest.advanceTimersByTimeAsync(12 * 60 * 60 * 1000);

      expect(mockDiscordService.sendMessage).not.toHaveBeenCalled();
    });

    it('should handle errors when sending messages', async () => {
      const guild1 = { id: '1', name: 'Guild 1' } as Guild;
      const channels1 = [{ id: 'c1', name: 'general' }] as TextChannel[];
      mockGuildService.getAllGuilds.mockReturnValue([guild1]);
      mockChannelDiscoveryService.discoverEligibleChannels.mockReturnValue(channels1);
      mockDiscordService.sendMessage.mockRejectedValue(new Error('Discord API Error'));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      wanderingService.start();
      await jest.advanceTimersByTimeAsync(12 * 60 * 60 * 1000);

      expect(mockDiscordService.sendMessage).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should not send messages if the client is not ready', async () => {
        mockClient.isReady.mockReturnValue(false);

        wanderingService.start();
        await jest.advanceTimersByTimeAsync(12 * 60 * 60 * 1000);

        expect(mockDiscordService.sendMessage).not.toHaveBeenCalled();
    });

    it('should respect per-guild rate limiting', async () => {
      const guild1 = { id: '1', name: 'Guild 1' } as Guild;
      const guild2 = { id: '2', name: 'Guild 2' } as Guild;
      const channels1 = [{ id: 'c1', name: 'general' }] as TextChannel[];
      const channels2 = [{ id: 'c2', name: 'general' }] as TextChannel[];

      mockGuildService.getAllGuilds.mockReturnValue([guild1, guild2]);
      mockChannelDiscoveryService.discoverEligibleChannels
        .mockReturnValueOnce(channels1)
        .mockReturnValueOnce(channels2);

      wanderingService.start();

      // First run, both guilds should get a message
      await jest.advanceTimersByTimeAsync(12 * 60 * 60 * 1000);
      expect(mockDiscordService.sendMessage).toHaveBeenCalledTimes(2);
      expect(mockDiscordService.sendMessage).toHaveBeenCalledWith(channels1[0].id, expect.any(String));
      expect(mockDiscordService.sendMessage).toHaveBeenCalledWith(channels2[0].id, expect.any(String));

      // Second run, after 5 hours (less than rate limit), no messages should be sent
      mockDiscordService.sendMessage.mockClear();
      await jest.advanceTimersByTimeAsync(5 * 60 * 60 * 1000);
      expect(mockDiscordService.sendMessage).not.toHaveBeenCalled();

      // Third run, after another 2 hours (total 7 hours, more than rate limit)
      // This will trigger the main 12-hour interval again, and since 7 hours have passed
      // for the per-guild limit, both should be eligible again.
      mockChannelDiscoveryService.discoverEligibleChannels
        .mockReturnValueOnce(channels1)
        .mockReturnValueOnce(channels2);
      mockDiscordService.sendMessage.mockClear();
      
      // We need to advance the main timer again to trigger the service
      await jest.advanceTimersByTimeAsync(7 * 60 * 60 * 1000);

      expect(mockDiscordService.sendMessage).toHaveBeenCalledTimes(2);
      expect(mockDiscordService.sendMessage).toHaveBeenCalledWith(channels1[0].id, expect.any(String));
      expect(mockDiscordService.sendMessage).toHaveBeenCalledWith(channels2[0].id, expect.any(String));
    });
  });
});