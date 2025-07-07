/**
 * @jest-environment node
 */
import { DiscordService } from '../../src/services/discord.service';
import { QuoteService } from '../../src/services/quote.service';
import { GuildService } from '../../src/services/guild.service';
import { ChannelDiscoveryService } from '../../src/services/channel-discovery.service';
import { ConfigService } from '../../src/services/config.service';
import { Client, Collection, Guild, TextChannel, ChannelType, PermissionsBitField, GuildMember } from 'discord.js';
import container from '../../src/container';
import { initialize as initializeWandering } from '../../src/modules/wandering';

// Remove WanderingService import and references. Use container.resolve('wanderingService') for all usages in this file.

// Mock the config service before anything else
jest.mock('../../src/services/config.service', () => ({
  ConfigService: jest.fn().mockImplementation(() => ({
    get: jest.fn((key: string) => {
      if (key === 'quotes') {
        return {
          generic_wandering_messages: ['Hello there!'],
          goblin_wandering_messages: { 'goblin-cave': ['Grrraaaah!'] },
        };
      }
      return null;
    }),
  })),
}));

// Mock the external dependencies
jest.mock('discord.js', () => {
    const { Collection } = require('@discordjs/collection');

    const MockPermissionsBitField = class {
        bits: bigint;
        static Flags: Record<string, bigint> = {
            SendMessages: 1n << 11n, // 2048n
            ViewChannel: 1n << 10n, // 1024n  
            ReadMessageHistory: 1n << 16n, // 65536n
        };
        constructor() {
            this.bits = 0n;
        }
        add(permission: bigint) {
            this.bits |= permission;
        }
        has(permission: bigint) {
            return (this.bits & permission) === permission;
        }
    };

    return {
        Client: jest.fn(() => ({
            login: jest.fn().mockResolvedValue(undefined),
            on: jest.fn((event, callback) => {
                if (event === 'ready') {
                    // Immediately call the ready callback
                    callback();
                }
            }),
            guilds: {
                cache: new Collection(),
            },
            isReady: jest.fn().mockReturnValue(true),
        })),
        GatewayIntentBits: { Guilds: 1, GuildMessages: 512 },
        PermissionsBitField: MockPermissionsBitField,
        ChannelType: {
            GuildText: 0,
            GuildVoice: 2,
        },
        Collection: Collection,
    };
});

describe('Full End-to-End Multi-Guild Integration Test', () => {
  let mockDiscordService: jest.Mocked<DiscordService>;
  let mockClient: jest.Mocked<Client>;
  let mockGuildService: jest.Mocked<GuildService>;
  let mockChannelDiscoveryService: jest.Mocked<ChannelDiscoveryService>;
  let mockQuoteService: jest.Mocked<QuoteService>;
  let mockConfigService: jest.Mocked<ConfigService>;

  // Helper to create mock messages with human activity for channel scoring
  const createMockMessage = (authorId: string, isBot: boolean, timestamp?: number): any => ({
    author: { id: authorId, bot: isBot },
    createdTimestamp: timestamp || Date.now() - (60 * 1000) // 1 minute ago by default
  });

  // Helper to create a fully mocked guild with channels and permissions
  const createMockGuild = (guildId: string, guildName: string, channels: any[]): Guild => {
    const mockGuild = {
      id: guildId,
      name: guildName,
      channels: {
        cache: new Collection<string, TextChannel>(),
      },
      members: {
        me: { id: 'bot-id' } as GuildMember,
      },
    } as unknown as Guild;

    channels.forEach(ch => {
      // Create human-dominated message history for scoring
      const humanMessages = new Collection();
      const messageHistory = [
        createMockMessage('user1', false),
        createMockMessage('user2', false),
        createMockMessage('user3', false),
        createMockMessage('user4', false),
        createMockMessage('user5', false),
      ];
      messageHistory.forEach((msg, index) => {
        humanMessages.set(`msg-${index}`, msg);
      });

      const channel = {
        id: ch.id,
        name: ch.name,
        type: ch.type,
        nsfw: ch.nsfw,
        guild: mockGuild,
        client: { user: { id: 'bot-id' } },
        permissionsFor: jest.fn(),
        messages: {
          fetch: jest.fn().mockResolvedValue(humanMessages)
        }
      } as unknown as TextChannel;

      const permissions = new PermissionsBitField();
      if (ch.canSend) {
        permissions.add(PermissionsBitField.Flags.SendMessages);
      }
      // Add required permissions for the new scoring system
      permissions.add(PermissionsBitField.Flags.ViewChannel);
      permissions.add(PermissionsBitField.Flags.ReadMessageHistory);
      
      (channel.permissionsFor as jest.Mock).mockReturnValue(permissions);
      mockGuild.channels.cache.set(ch.id, channel);
    });

    return mockGuild;
  };

  beforeAll(() => {
    // Register core services for tests that use dynamic DI
    container.register('databaseService', (c) => c.databaseService);
    container.register('quoteService', (c) => c.quoteService);
    container.register('guildService', (c) => c.guildService);
    container.register('channelDiscoveryService', (c) => c.channelDiscoveryService);
    container.register('configService', (c) => c.configService);

    initializeWandering(container);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset environment variables
    delete process.env.ALLOWED_GUILD_IDS;

    // Setup DiscordService with a mocked client
    mockClient = new (jest.requireMock('discord.js').Client)() as jest.Mocked<Client>;
    mockDiscordService = {
      getClient: jest.fn().mockReturnValue(mockClient),
      sendMessage: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<DiscordService>;

    // Create mocked services instead of using container
    mockGuildService = {
      getAllGuilds: jest.fn().mockReturnValue([]),
    } as unknown as jest.Mocked<GuildService>;

    mockChannelDiscoveryService = {
      discoverEligibleChannels: jest.fn().mockReturnValue([]),
    } as unknown as jest.Mocked<ChannelDiscoveryService>;

    mockQuoteService = {
      getWanderingMessage: jest.fn().mockImplementation((channelName) => {
        if (channelName === 'goblin-cave') return 'Grrraaaah!';
        return 'Hello there!';
      }),
    } as unknown as jest.Mocked<QuoteService>;

    mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'minScoreThreshold') return 30;
        if (key === 'lonelinessBonusPointsPerDay') return 15;
        return undefined;
      }),
    } as unknown as jest.Mocked<ConfigService>;
  });

  it('should validate the complete multi-guild workflow without ALLOWED_GUILD_IDS restrictions', async () => {
    // Arrange: Create multiple guilds with various channel setups
    const guild1 = createMockGuild('g1', 'Guild One', [
      { id: 'c1', name: 'general', type: ChannelType.GuildText, nsfw: false, canSend: true },
      { id: 'c2', name: 'chat', type: ChannelType.GuildText, nsfw: false, canSend: true },
      { id: 'c3', name: 'no-perms-here', type: ChannelType.GuildText, nsfw: false, canSend: false },
    ]);
    const guild2 = createMockGuild('g2', 'Guild Two', [
      { id: 'c4', name: 'bot-commands', type: ChannelType.GuildText, nsfw: false, canSend: true },
      { id: 'c5', name: 'super-secret-chat', type: ChannelType.GuildText, nsfw: false, canSend: true },
      { id: 'c6', name: 'nsfw-channel', type: ChannelType.GuildText, nsfw: true, canSend: true },
    ]);
    const guild3 = createMockGuild('g3', 'Guild Three (No Eligible Channels)', [
        { id: 'c7', name: 'voice-channel', type: ChannelType.GuildVoice, nsfw: false, canSend: true },
        { id: 'c8', name: 'announcements-no-send', type: ChannelType.GuildText, nsfw: false, canSend: false },
    ]);
    const guild4 = createMockGuild('g4', 'Guild Four (Special Quotes)', [
        { id: 'c9', name: 'goblin-cave', type: ChannelType.GuildText, nsfw: false, canSend: true },
    ]);

    // Configure mock services with guild data
    (mockGuildService.getAllGuilds as jest.Mock).mockReturnValue([guild1, guild2, guild3, guild4]);
    (mockChannelDiscoveryService.discoverEligibleChannels as jest.Mock)
      .mockImplementation((guild) => {
        if (guild.id === 'g1') return [guild1.channels.cache.get('c1'), guild1.channels.cache.get('c2')];
        if (guild.id === 'g2') return [guild2.channels.cache.get('c4'), guild2.channels.cache.get('c5')];
        if (guild.id === 'g4') return [guild4.channels.cache.get('c9')];
        return [];
      });
    
    // Add guilds to mock client for reference
    mockClient.guilds.cache.set(guild1.id, guild1);
    mockClient.guilds.cache.set(guild2.id, guild2);
    mockClient.guilds.cache.set(guild3.id, guild3);
    mockClient.guilds.cache.set(guild4.id, guild4);

    // Act: Trigger the wandering message logic
    // Manually set startup delay as complete to bypass timing
    (container.resolve('wanderingService') as any).hasStartupDelayPassed = true;
    // We access the private method for a direct and predictable test
    await (container.resolve('wanderingService') as any).runDecisionCycle();

    // Assert: Check that sendMessage was called exactly once per decision cycle
    // New behavior: Only one guild gets a message per cycle to prevent spam
    expect(mockDiscordService.sendMessage).toHaveBeenCalledTimes(1);

    // Check that exactly one message was sent to one eligible channel
    const allCalls = (mockDiscordService.sendMessage as jest.Mock).mock.calls;
    expect(allCalls).toHaveLength(1);
    
    // Verify the message was sent to an eligible channel that meets scoring criteria
    const sentChannelId = allCalls[0][0];
    const eligibleChannelIds = ['c1', 'c2', 'c4', 'c5', 'c9']; // All non-NSFW, non-voice channels with permissions
    expect(eligibleChannelIds).toContain(sentChannelId);
    
    // Verify appropriate message was sent
    const sentMessage = allCalls[0][1];
    expect(['Hello there!', 'Grrraaaah!']).toContain(sentMessage);
    
    // Verify that ineligible channels were not considered
    // (NSFW channels, voice channels, channels without permissions are filtered out)
    expect(mockDiscordService.sendMessage).not.toHaveBeenCalledWith('c3', expect.any(String)); // No permissions
    expect(mockDiscordService.sendMessage).not.toHaveBeenCalledWith('c6', expect.any(String)); // NSFW
    expect(mockDiscordService.sendMessage).not.toHaveBeenCalledWith('c7', expect.any(String)); // Voice channel
    expect(mockDiscordService.sendMessage).not.toHaveBeenCalledWith('c8', expect.any(String)); // No permissions
  });
});