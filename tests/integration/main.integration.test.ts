/**
 * Integration Tests for Bogart Discord Bot's Multi-Guild Architecture
 *
 * These tests validate the complete end-to-end flow of the multi-guild system, ensuring
 * that the WanderingService correctly interacts with the GuildService and
 * ChannelDiscoveryService to send a single, correctly-targeted message per guild.
 */

import { WanderingService } from '../../src/services/wandering.service';
import { DiscordService } from '../../src/services/discord.service';
import { QuoteService } from '../../src/services/quote.service';
import { GuildService } from '../../src/services/guild.service';
import { ChannelDiscoveryService } from '../../src/services/channel-discovery.service';
import { ConfigService } from '../../src/services/config.service';
import { Client, Collection, Guild, TextChannel, ChannelType, PermissionsBitField, GuildMember } from 'discord.js';

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
            on: jest.fn(),
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

jest.mock('../../src/services/config.service');

describe('Multi-Guild Integration Test', () => {
  let wanderingService: WanderingService;
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
      getWanderingMessage: jest.fn().mockReturnValue('Hello there!'),
    } as unknown as jest.Mocked<QuoteService>;

    mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'minScoreThreshold') return 30;
        if (key === 'lonelinessBonusPointsPerDay') return 15;
        return undefined;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    wanderingService = new WanderingService(
      mockDiscordService,
      mockQuoteService,
      mockGuildService,
      mockChannelDiscoveryService,
      mockConfigService
    );
  });

  it('should send exactly one message per decision cycle to prevent spam', async () => {
    // Arrange: Create two guilds with a mix of eligible and ineligible channels
    const guild1 = createMockGuild('g1', 'Guild One', [
      { id: 'c1', name: 'general', type: ChannelType.GuildText, nsfw: false, canSend: true },
      { id: 'c2', name: 'random-chat', type: ChannelType.GuildText, nsfw: false, canSend: true },
      { id: 'c3', name: 'no-perms', type: ChannelType.GuildText, nsfw: false, canSend: false },
    ]);
    const guild2 = createMockGuild('g2', 'Guild Two', [
      { id: 'c4', name: 'bot-spam', type: ChannelType.GuildText, nsfw: false, canSend: true },
      { id: 'c5', name: 'super-secret', type: ChannelType.GuildText, nsfw: false, canSend: true },
      { id: 'c6', name: 'nsfw-zone', type: ChannelType.GuildText, nsfw: true, canSend: true },
    ]);
    const guild3 = createMockGuild('g3', 'Guild Three (No Eligible Channels)', [
        { id: 'c7', name: 'voice-only', type: ChannelType.GuildVoice, nsfw: false, canSend: true },
        { id: 'c8', name: 'announcements', type: ChannelType.GuildText, nsfw: false, canSend: false },
    ]);
    
    // Add guilds to mock client for reference
    mockClient.guilds.cache.set(guild1.id, guild1);
    mockClient.guilds.cache.set(guild2.id, guild2);
    mockClient.guilds.cache.set(guild3.id, guild3);
    
    // Configure mock services with guild data
    (mockGuildService.getAllGuilds as jest.Mock).mockReturnValue([guild1, guild2, guild3]);
    (mockChannelDiscoveryService.discoverEligibleChannels as jest.Mock)
      .mockImplementation((guild) => {
        if (guild.id === 'g1') return [guild1.channels.cache.get('c1'), guild1.channels.cache.get('c2')];
        if (guild.id === 'g2') return [guild2.channels.cache.get('c4')];
        return [];
      });
    
    // Act: Trigger the wandering message logic
    // Manually set startup delay as complete to bypass timing
    (wanderingService as any).hasStartupDelayPassed = true;
    // We access the private method for a direct and predictable test
    await (wanderingService as any).runDecisionCycle();

    // Assert: Check that sendMessage was called exactly once per decision cycle
    // New behavior: Only one message per cycle to prevent spam
    expect(mockDiscordService.sendMessage).toHaveBeenCalledTimes(1);

    // Check that exactly one message was sent to one eligible channel
    const allCalls = mockDiscordService.sendMessage.mock.calls;
    expect(allCalls).toHaveLength(1);
    
    // Verify the message was sent to an eligible channel
    const sentChannelId = allCalls[0][0];
    const eligibleChannelIds = ['c1', 'c2', 'c4']; // All eligible channels
    expect(eligibleChannelIds).toContain(sentChannelId);
    expect(allCalls[0][1]).toBe('Hello there!');

    // Check that no messages were sent to ineligible channels
    expect(mockDiscordService.sendMessage).not.toHaveBeenCalledWith('c3', expect.any(String));
    expect(mockDiscordService.sendMessage).not.toHaveBeenCalledWith('c5', expect.any(String));
    expect(mockDiscordService.sendMessage).not.toHaveBeenCalledWith('c6', expect.any(String));
    expect(mockDiscordService.sendMessage).not.toHaveBeenCalledWith('c7', expect.any(String));
    expect(mockDiscordService.sendMessage).not.toHaveBeenCalledWith('c8', expect.any(String));
  });

  it('should only send messages to guilds in ALLOWED_GUILD_IDS when set', async () => {
    // Arrange: Set the allowed guild IDs environment variable
    process.env.ALLOWED_GUILD_IDS = 'g1,g3'; // Allow Guild One and Three


    const guild1 = createMockGuild('g1', 'Guild One', [
      { id: 'c1', name: 'general', type: ChannelType.GuildText, nsfw: false, canSend: true },
    ]);
    const guild2 = createMockGuild('g2', 'Guild Two', [
      { id: 'c4', name: 'bot-spam', type: ChannelType.GuildText, nsfw: false, canSend: true },
    ]);
    const guild3 = createMockGuild('g3', 'Guild Three (Allowed but no eligible channels)', [
      { id: 'c7', name: 'no-perms', type: ChannelType.GuildText, nsfw: false, canSend: false },
    ]);

    // Configure mock services with guild data
    (mockGuildService.getAllGuilds as jest.Mock).mockReturnValue([guild1, guild2, guild3]);
    (mockChannelDiscoveryService.discoverEligibleChannels as jest.Mock)
      .mockImplementation((guild) => {
        if (guild.id === 'g1') return [guild1.channels.cache.get('c1')];
        return [];
      });

    mockClient.guilds.cache.set(guild1.id, guild1);
    mockClient.guilds.cache.set(guild2.id, guild2);
    mockClient.guilds.cache.set(guild3.id, guild3);

    // Act
    // Manually set startup delay as complete to bypass timing
    (wanderingService as any).hasStartupDelayPassed = true;
    await (wanderingService as any).runDecisionCycle();

    // Assert: Check that only one message was sent to the allowed guild
    expect(mockDiscordService.sendMessage).toHaveBeenCalledTimes(1);
    
    // Verify the message was sent to an eligible channel in an allowed guild
    const allCalls = mockDiscordService.sendMessage.mock.calls;
    const sentChannelId = allCalls[0][0];
    expect(['c1'].includes(sentChannelId)).toBe(true); // Only c1 from g1 is eligible and allowed
    expect(allCalls[0][1]).toBe('Hello there!');
    
    // Ensure no message was sent to the non-allowed guild (g2)
    expect(mockDiscordService.sendMessage).not.toHaveBeenCalledWith('c4', expect.any(String));

    // Cleanup env var
    delete process.env.ALLOWED_GUILD_IDS;
  });
});