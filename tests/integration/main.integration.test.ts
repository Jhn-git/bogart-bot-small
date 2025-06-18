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
  let mockConfigService: jest.Mocked<ConfigService>;

  // Helper to create a fully mocked guild with channels and permissions
  const createMockGuild = (guildId: string, guildName: string, channels: any[]): Guild => {
    const mockGuild = {
      id: guildId,
      name: guildName,
      channels: {
        cache: new Collection<string, TextChannel>(),
      },
      members: {
        me: {} as GuildMember,
      },
    } as unknown as Guild;

    channels.forEach(ch => {
      const channel = {
        id: ch.id,
        name: ch.name,
        type: ch.type,
        nsfw: ch.nsfw,
        guild: mockGuild,
        permissionsFor: jest.fn(),
      } as unknown as TextChannel;

      const permissions = new PermissionsBitField();
      if (ch.canSend) {
        permissions.add(PermissionsBitField.Flags.SendMessages);
      }
      (channel.permissionsFor as jest.Mock).mockReturnValue(permissions);
      mockGuild.channels.cache.set(ch.id, channel);
    });

    return mockGuild;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock ConfigService to provide necessary quotes
    mockConfigService = new ConfigService() as jest.Mocked<ConfigService>;
    (mockConfigService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'quotes') {
            return {
                generic_wandering_messages: ['Hello there!'],
                goblin_wandering_messages: { 'goblin-cave': ['Grrraaaah!'] }
            };
        }
        return null;
    });

    // Setup DiscordService with a mocked client
    mockClient = new (jest.requireMock('discord.js').Client)() as jest.Mocked<Client>;
    mockDiscordService = {
      getClient: jest.fn().mockReturnValue(mockClient),
      sendMessage: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<DiscordService>;

    // Real services that will be tested
    const guildService = new GuildService(mockDiscordService);
    const channelDiscoveryService = new ChannelDiscoveryService(mockConfigService);
    const quoteService = new QuoteService(mockConfigService);

    wanderingService = new WanderingService(
      mockDiscordService,
      quoteService,
      guildService,
      channelDiscoveryService
    );
  });

  it('should send exactly one message per guild to an eligible channel', async () => {
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
    
    // Add the guilds to the client's cache
    mockClient.guilds.cache.set(guild1.id, guild1);
    mockClient.guilds.cache.set(guild2.id, guild2);
    mockClient.guilds.cache.set(guild3.id, guild3);
    
    // Act: Trigger the wandering message logic
    // We access the private method for a direct and predictable test
    await (wanderingService as any).sendWanderingMessages();

    // Assert: Check that sendMessage was called correctly
    expect(mockDiscordService.sendMessage).toHaveBeenCalledTimes(2);

    // Check Guild One: one of the two eligible channels should have been used
    const guild1Calls = mockDiscordService.sendMessage.mock.calls.filter(call =>
      ['c1', 'c2'].includes(call[0])
    );
    expect(guild1Calls).toHaveLength(1);
    expect(guild1Calls[0][1]).toBe('Hello there!');

    // Check Guild Two: only one eligible channel exists
    const guild2Calls = mockDiscordService.sendMessage.mock.calls.filter(call =>
      ['c4'].includes(call[0])
    );
    expect(guild2Calls).toHaveLength(1);
    expect(guild2Calls[0][1]).toBe('Hello there!');

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

    // We need to re-initialize the services that depend on the environment variable
    const guildService = new GuildService(mockDiscordService);
    const channelDiscoveryService = new ChannelDiscoveryService(mockConfigService);
    const quoteService = new QuoteService(mockConfigService);
    wanderingService = new WanderingService(
      mockDiscordService,
      quoteService,
      guildService,
      channelDiscoveryService
    );

    const guild1 = createMockGuild('g1', 'Guild One', [
      { id: 'c1', name: 'general', type: ChannelType.GuildText, nsfw: false, canSend: true },
    ]);
    const guild2 = createMockGuild('g2', 'Guild Two', [
      { id: 'c4', name: 'bot-spam', type: ChannelType.GuildText, nsfw: false, canSend: true },
    ]);
    const guild3 = createMockGuild('g3', 'Guild Three (Allowed but no eligible channels)', [
      { id: 'c7', name: 'no-perms', type: ChannelType.GuildText, nsfw: false, canSend: false },
    ]);

    mockClient.guilds.cache.set(guild1.id, guild1);
    mockClient.guilds.cache.set(guild2.id, guild2);
    mockClient.guilds.cache.set(guild3.id, guild3);

    // Act
    await (wanderingService as any).sendWanderingMessages();

    // Assert
    expect(mockDiscordService.sendMessage).toHaveBeenCalledTimes(1);
    expect(mockDiscordService.sendMessage).toHaveBeenCalledWith('c1', 'Hello there!');
    
    // Ensure no message was sent to the non-allowed guild (g2)
    expect(mockDiscordService.sendMessage).not.toHaveBeenCalledWith('c4', expect.any(String));

    // Cleanup env var
    delete process.env.ALLOWED_GUILD_IDS;
  });
});