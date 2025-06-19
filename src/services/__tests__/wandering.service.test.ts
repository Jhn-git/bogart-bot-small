// src/services/__tests__/wandering.service.test.ts

import { WanderingService } from '../wandering.service';
import { DiscordService } from '../discord.service';
import { QuoteService } from '../quote.service';
import { GuildService } from '../guild.service';
import { ChannelDiscoveryService } from '../channel-discovery.service';
import { ConfigService } from '../config.service';
import { Guild, TextChannel, Collection, Message, User, PermissionsBitField } from 'discord.js';
import { Client } from 'discord.js';
import * as fs from 'fs';

jest.useFakeTimers();

// Mock services
jest.mock('../discord.service');
jest.mock('../quote.service');
jest.mock('../guild.service');
jest.mock('../channel-discovery.service');
jest.mock('fs');

describe('WanderingService', () => {
  let wanderingService: WanderingService;
  let mockDiscordService: jest.Mocked<DiscordService>;
  let mockQuoteService: jest.Mocked<QuoteService>;
  let mockGuildService: jest.Mocked<GuildService>;
  let mockChannelDiscoveryService: jest.Mocked<ChannelDiscoveryService>;
  let mockClient: jest.Mocked<Client>;

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(Math, 'random').mockReturnValue(0.5); // Prevent flaky tests due to timing jitter

    const mockFs = fs as jest.Mocked<typeof fs>;
    const mockYaml = `
generic_wandering_messages:
  - "A wandering message."
goblin_wandering_messages:
  "goblin-cave":
    - "Grrraaaah!"
channel_specific_wandering_messages: {}
`;
    // Make the mock aware of the file being accessed
    mockFs.existsSync.mockImplementation((path) => {
      if (path === 'data/quotes.yaml' || path.toString().includes('cooldowns.json') || path === 'data') {
        return true;
      }
      return false;
    });
    mockFs.readFileSync.mockImplementation((path) => {
      if (path === 'data/quotes.yaml') {
        return mockYaml;
      }
      if (path.toString().includes('cooldowns.json')) {
        return '{}'; // Return empty JSON for cooldowns
      }
      return '';
    });
    mockFs.writeFileSync.mockImplementation(() => {});
    mockFs.renameSync.mockImplementation(() => {});
    mockFs.mkdirSync.mockImplementation(() => undefined);

    mockClient = {
      isReady: jest.fn().mockReturnValue(true),
      user: { id: 'bot-id' }
    } as unknown as jest.Mocked<Client>;

    // Create fully mocked services instead of using real instances
    mockDiscordService = {
      getClient: jest.fn().mockReturnValue(mockClient),
      sendMessage: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<DiscordService>;

    const mockConfigService = {
      get: jest.fn().mockReturnValue({
        generic_wandering_messages: ['A wandering message.'],
        goblin_wandering_messages: {
          'goblin-cave': ['Grrraaaah!']
        },
        channel_specific_wandering_messages: {
          'general': ['Hello general channel!']
        },
      }),
    } as unknown as jest.Mocked<ConfigService>;

    mockQuoteService = {
      getWanderingMessage: jest.fn().mockReturnValue('A wandering message.'),
    } as unknown as jest.Mocked<QuoteService>;

    mockGuildService = {
      getAllGuilds: jest.fn().mockReturnValue([]),
    } as unknown as jest.Mocked<GuildService>;

    mockChannelDiscoveryService = {
      discoverEligibleChannels: jest.fn().mockReturnValue([]),
    } as unknown as jest.Mocked<ChannelDiscoveryService>;

    wanderingService = new WanderingService(
      mockDiscordService,
      mockQuoteService,
      mockGuildService,
      mockChannelDiscoveryService
    );
  });

  afterEach(() => {
    if (wanderingService) {
      wanderingService.stop();
    }
  });

  // Helper function to create mock messages with human/bot authors
  const createMockMessage = (authorId: string, isBot: boolean, timestamp?: number): any => ({
    author: { id: authorId, bot: isBot } as User,
    createdTimestamp: timestamp || Date.now() - (30 * 1000) // 30 seconds ago by default for high recency score
  });

  // Helper function to create mock channel with message history
  const createMockChannel = (id: string, name: string, messages: any[] = []): any => {
    const mockMessages = new Collection<string, any>();
    messages.forEach((msg, index) => {
      mockMessages.set(`msg-${index}`, msg);
    });

    return {
      id,
      name,
      client: mockClient,
      guild: { members: { me: { id: 'bot-id' } } } as any,
      permissionsFor: jest.fn().mockReturnValue({
        has: jest.fn().mockReturnValue(true)
      }),
      messages: {
        fetch: jest.fn().mockResolvedValue(mockMessages)
      }
    };
  };

  // Helper function to create a more realistic mock guild
  const createMockGuild = (id: string, name: string, channels: any[]): any => {
    const guild = {
      id,
      name,
      channels: { cache: new Collection() },
      members: { me: { id: 'bot-id' } }
    };
    channels.forEach(ch => guild.channels.cache.set(ch.id, ch));
    return guild;
  };

  describe('sendWanderingMessages', () => {
    it('should send a message to only ONE channel per decision cycle', async () => {
      // Arrange
      const humanMessages = [
        createMockMessage('user1', false), createMockMessage('user2', false),
        createMockMessage('user3', false), createMockMessage('user4', false),
        createMockMessage('user5', false),
      ];
      const channels1 = [createMockChannel('c1', 'general-1', humanMessages)];
      const channels2 = [createMockChannel('c2', 'general-2', humanMessages)];
      const guild1 = createMockGuild('1', 'Guild 1', channels1);
      const guild2 = createMockGuild('2', 'Guild 2', channels2);
      const allChannelIds = [channels1[0].id, channels2[0].id];

      (mockGuildService.getAllGuilds as jest.Mock).mockReturnValue([guild1, guild2]);
      (mockChannelDiscoveryService.discoverEligibleChannels as jest.Mock)
        .mockImplementation((guild) => {
          if (guild.id === '1') return channels1;
          if (guild.id === '2') return channels2;
          return [];
        });

      // Act
      wanderingService.start();
      
      // Advance past startup delay (2 minutes) + first decision cycle (10 minutes)
      await jest.advanceTimersByTimeAsync(12 * 60 * 1000);
      
      // Advance timers to complete any internal delays (100ms between guilds)
      await jest.advanceTimersByTimeAsync(1000);
      
      // Assert: Only one message should be sent
      expect(mockDiscordService.sendMessage).toHaveBeenCalledTimes(1);
      
      const sentChannelId = mockDiscordService.sendMessage.mock.calls[0][0];
      expect(allChannelIds).toContain(sentChannelId);
    });

    it('should not send messages if no guilds are found', async () => {
      (mockGuildService.getAllGuilds as jest.Mock).mockReturnValue([]);
      
      wanderingService.start();
      await jest.advanceTimersByTimeAsync(12 * 60 * 1000);
      await jest.advanceTimersByTimeAsync(1000);

      expect(mockDiscordService.sendMessage).not.toHaveBeenCalled();
    });

    it('should not send messages to a guild with no eligible channels', async () => {
      const guild1 = createMockGuild('1', 'Guild 1', []);
      (mockGuildService.getAllGuilds as jest.Mock).mockReturnValue([guild1]);
      (mockChannelDiscoveryService.discoverEligibleChannels as jest.Mock).mockReturnValue([]);

      wanderingService.start();
      await jest.advanceTimersByTimeAsync(12 * 60 * 1000);
      await jest.advanceTimersByTimeAsync(1000);

      expect(mockDiscordService.sendMessage).not.toHaveBeenCalled();
    });

    it('should handle errors when sending messages', async () => {
      const humanMessages = [
        createMockMessage('user1', false),
        createMockMessage('user2', false),
        createMockMessage('user3', false),
        createMockMessage('user4', false),
        createMockMessage('user5', false),
      ];
      const channels1 = [createMockChannel('c1', 'general', humanMessages)];
      const guild1 = createMockGuild('1', 'Guild 1', channels1);
      (mockGuildService.getAllGuilds as jest.Mock).mockReturnValue([guild1]);
      (mockChannelDiscoveryService.discoverEligibleChannels as jest.Mock).mockImplementation((guild) => {
        if (guild.id === '1') return channels1;
        return [];
      });
      mockDiscordService.sendMessage.mockResolvedValue(false);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      wanderingService.start();
      // Use the new decision cycle interval (10 minutes + startup delay)
      await jest.advanceTimersByTimeAsync(12 * 60 * 1000);
      await jest.advanceTimersByTimeAsync(1000);

      expect(mockDiscordService.sendMessage).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to send message'));
      consoleErrorSpy.mockRestore();
    });

    it('should not send messages if the client is not ready', async () => {
        mockClient.isReady.mockReturnValue(false);

        wanderingService.start();
        await jest.advanceTimersByTimeAsync(12 * 60 * 1000);
        await jest.advanceTimersByTimeAsync(1000);

        expect(mockDiscordService.sendMessage).not.toHaveBeenCalled();
    });

    it('should respect per-guild rate limiting and send one message per cycle', async () => {
      const humanMessages = [
        createMockMessage('user1', false), createMockMessage('user2', false),
        createMockMessage('user3', false), createMockMessage('user4', false),
        createMockMessage('user5', false),
      ];
      const channels1 = [createMockChannel('c1', 'general-1', humanMessages)];
      const channels2 = [createMockChannel('c2', 'general-2', humanMessages)];
      const guild1 = createMockGuild('1', 'Guild 1', channels1);
      const guild2 = createMockGuild('2', 'Guild 2', channels2);
      const allChannelIds = [channels1[0].id, channels2[0].id];

      (mockGuildService.getAllGuilds as jest.Mock).mockReturnValue([guild1, guild2]);
      // Ensure discoverEligibleChannels is mocked for every call within a cycle
      (mockChannelDiscoveryService.discoverEligibleChannels as jest.Mock)
        .mockImplementation((guild) => {
          if (guild.id === '1') return channels1;
          if (guild.id === '2') return channels2;
          return [];
        });

      wanderingService.start();

      // --- First Run ---
      // Advance time for startup + 1st decision cycle
      await jest.advanceTimersByTimeAsync(12 * 60 * 1000);
      await jest.advanceTimersByTimeAsync(1000);
      
      expect(mockDiscordService.sendMessage).toHaveBeenCalledTimes(1);
      const firstCall = mockDiscordService.sendMessage.mock.calls[0];
      const firstChannelId = firstCall[0];
      expect(allChannelIds).toContain(firstChannelId);

      // --- Second Run ---
      // The guild that just received a message is on a 6-hour cooldown.
      // The other guild should be targeted in the next cycle.
      mockDiscordService.sendMessage.mockClear();
      
      // Advance time for 2nd decision cycle
      await jest.advanceTimersByTimeAsync(10 * 60 * 1000);
      await jest.advanceTimersByTimeAsync(1000);
      
      expect(mockDiscordService.sendMessage).toHaveBeenCalledTimes(1);
      const secondCall = mockDiscordService.sendMessage.mock.calls[0];
      const secondChannelId = secondCall[0];
      expect(allChannelIds).toContain(secondChannelId);
      // Ensure it's not the same guild as the first call
      expect(secondChannelId).not.toBe(firstChannelId);

      // --- Third Run (After Cooldown) ---
      // Stop service to prevent interference during time advancement
      wanderingService.stop();
      
      // Advance time for cooldowns to expire
      await jest.advanceTimersByTimeAsync(7 * 60 * 60 * 1000); // 7 hours to clear all cooldowns
      
      // Clear mocks and restart service
      mockDiscordService.sendMessage.mockClear();
      
      // Reset discovery mock for the new set of cycles
      (mockChannelDiscoveryService.discoverEligibleChannels as jest.Mock)
        .mockImplementation((guild) => {
          if (guild.id === '1') return channels1;
          if (guild.id === '2') return channels2;
          return [];
        });

      // Restart service and trigger one decision cycle
      wanderingService.start();
      await jest.advanceTimersByTimeAsync(12 * 60 * 1000); // Startup + one cycle
      await jest.advanceTimersByTimeAsync(1000); // Complete async operations
      
      expect(mockDiscordService.sendMessage).toHaveBeenCalledTimes(1);
      const thirdCall = mockDiscordService.sendMessage.mock.calls[0];
      const thirdChannelId = thirdCall[0];
      expect(allChannelIds).toContain(thirdChannelId);
    });

    it('should avoid channels dominated by bot messages', async () => {
      // Create bot-dominated channel (80% bot messages)
      const botDominatedMessages = [
        createMockMessage('bot1', true),
        createMockMessage('bot2', true),
        createMockMessage('bot3', true),
        createMockMessage('bot4', true),
        createMockMessage('user1', false) // Only 20% human
      ];
      
      // Create human-friendly channel (80% human messages)
      const humanFriendlyMessages = [
        createMockMessage('user1', false),
        createMockMessage('user2', false),
        createMockMessage('user3', false),
        createMockMessage('user4', false),
        createMockMessage('bot1', true) // Only 20% bot
      ];
      
      const channels = [
        createMockChannel('c1', 'bot-logs', botDominatedMessages),
        createMockChannel('c2', 'general', humanFriendlyMessages),
      ];

      const guild1 = createMockGuild('1', 'Guild 1', channels);
      (mockGuildService.getAllGuilds as jest.Mock).mockReturnValue([guild1]);
      (mockChannelDiscoveryService.discoverEligibleChannels as jest.Mock).mockImplementation((guild) => {
        if (guild.id === '1') return channels;
        return [];
      });

      wanderingService.start();
      await jest.advanceTimersByTimeAsync(12 * 60 * 1000);
      await jest.advanceTimersByTimeAsync(1000);

      // Should send to human-friendly channel, not bot-dominated
      expect(mockDiscordService.sendMessage).toHaveBeenCalledTimes(1);
      expect(mockDiscordService.sendMessage).toHaveBeenCalledWith('c2', expect.any(String));
    });

    it('should handle zero-human channels correctly', async () => {
      // Create zero-human channel (100% bot messages)
      const zeroHumanMessages = [
        createMockMessage('bot1', true),
        createMockMessage('bot2', true),
        createMockMessage('bot3', true),
        createMockMessage('bot4', true),
        createMockMessage('bot5', true)
      ];
      
      // Create human channel for comparison
      const humanMessages = [
        createMockMessage('user1', false),
        createMockMessage('user2', false),
        createMockMessage('user3', false)
      ];
      
      const channels = [
        createMockChannel('c1', 'bot-logs', zeroHumanMessages),
        createMockChannel('c2', 'general', humanMessages),
      ];

      const guild1 = createMockGuild('1', 'Guild 1', channels);
      (mockGuildService.getAllGuilds as jest.Mock).mockReturnValue([guild1]);
      (mockChannelDiscoveryService.discoverEligibleChannels as jest.Mock).mockImplementation((guild) => {
        if (guild.id === '1') return channels;
        return [];
      });

      wanderingService.start();
      await jest.advanceTimersByTimeAsync(12 * 60 * 1000);
      await jest.advanceTimersByTimeAsync(1000);

      // Zero-human channel should be avoided due to extremely low score
      expect(mockDiscordService.sendMessage).toHaveBeenCalledTimes(1);
      expect(mockDiscordService.sendMessage).toHaveBeenCalledWith('c2', expect.any(String));
    });

    describe('cooldown persistence', () => {
      it('should load existing cooldowns on startup', () => {
        // Mock existing cooldowns file
        const mockCooldowns = {
          'guild1': Date.now() + (6 * 60 * 60 * 1000), // 6 hours from now
          'guild2': Date.now() - (1 * 60 * 60 * 1000), // 1 hour ago (expired)
        };
        
        (fs as jest.Mocked<typeof fs>).existsSync.mockReturnValue(true);
        (fs as jest.Mocked<typeof fs>).readFileSync.mockReturnValue(JSON.stringify(mockCooldowns));

        // Create new service instance to trigger loading
        const newService = new WanderingService(
          mockDiscordService,
          mockQuoteService,
          mockGuildService,
          mockChannelDiscoveryService
        );

        expect(fs.existsSync).toHaveBeenCalledWith(expect.stringContaining('cooldowns.json'));
        expect(fs.readFileSync).toHaveBeenCalledWith(expect.stringContaining('cooldowns.json'), 'utf8');
        
        // Clean up the new service
        newService.stop();
      });

      it('should save cooldowns after sending a message', async () => {
        const humanMessages = [
          createMockMessage('user1', false),
          createMockMessage('user2', false),
          createMockMessage('user3', false),
        ];
        const channels1 = [createMockChannel('c1', 'general', humanMessages)];
        const guild1 = createMockGuild('1', 'Guild 1', channels1);
        
        (mockGuildService.getAllGuilds as jest.Mock).mockReturnValue([guild1]);
        (mockChannelDiscoveryService.discoverEligibleChannels as jest.Mock).mockImplementation((guild) => {
          if (guild.id === '1') return channels1;
          return [];
        });

        wanderingService.start();
        await jest.advanceTimersByTimeAsync(12 * 60 * 1000);
        await jest.advanceTimersByTimeAsync(1000);

        // Should save cooldowns after sending message
        expect(fs.writeFileSync).toHaveBeenCalled();
        expect(fs.renameSync).toHaveBeenCalledWith(expect.stringContaining('cooldowns.json.tmp'), expect.stringContaining('cooldowns.json'));
      });

      it('should save cooldowns on service stop', () => {
        wanderingService.stop();
        
        expect(fs.writeFileSync).toHaveBeenCalled();
        expect(fs.renameSync).toHaveBeenCalledWith(expect.stringContaining('cooldowns.json.tmp'), expect.stringContaining('cooldowns.json'));
      });

      it('should handle corrupted cooldowns file gracefully', () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        // Mock corrupted file
        (fs as jest.Mocked<typeof fs>).existsSync.mockReturnValue(true);
        (fs as jest.Mocked<typeof fs>).readFileSync.mockReturnValue('invalid json');

        // Should not throw error during construction
        expect(() => {
          const newService = new WanderingService(
            mockDiscordService,
            mockQuoteService,
            mockGuildService,
            mockChannelDiscoveryService
          );
          newService.stop();
        }).not.toThrow();

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'WanderingService: Error loading cooldowns from persistent storage:',
          expect.any(Error)
        );
        consoleErrorSpy.mockRestore();
      });

      it('should handle file write errors gracefully', async () => {
        const humanMessages = [
          createMockMessage('user1', false),
          createMockMessage('user2', false),
        ];
        const channels1 = [createMockChannel('c1', 'general', humanMessages)];
        const guild1 = createMockGuild('1', 'Guild 1', channels1);
        (mockGuildService.getAllGuilds as jest.Mock).mockReturnValue([guild1]);
        (mockChannelDiscoveryService.discoverEligibleChannels as jest.Mock).mockImplementation((guild) => {
          if (guild.id === '1') return channels1;
          return [];
        });
        
        (fs as jest.Mocked<typeof fs>).writeFileSync.mockImplementation(() => { throw new Error('Disk full'); });

        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        wanderingService.start();
        await jest.advanceTimersByTimeAsync(12 * 60 * 1000);
        await jest.advanceTimersByTimeAsync(1000);

        // Should log error but continue functioning
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'WanderingService: Error saving cooldowns to persistent storage:',
          expect.any(Error)
        );
        
        consoleErrorSpy.mockRestore();
      });
    });
  });
});