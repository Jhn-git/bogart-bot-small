/**
 * @jest-environment node
 */
import { WanderingService } from '../../src/services/wandering.service';
import { DiscordService } from '../../src/services/discord.service';
import { Client, Collection, Guild, TextChannel, ChannelType, PermissionsBitField, GuildMember } from 'discord.js';

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
  let wanderingService: WanderingService;
  let mockDiscordService: jest.Mocked<DiscordService>;
  let mockClient: jest.Mocked<Client>;
  let container: any;

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
    jest.resetModules(); // Reset module cache to re-evaluate imports
    jest.clearAllMocks();

    // Dynamically import the container *after* mocks are set up
    container = require('../../src/container').default;
    
    // Reset environment variables
    delete process.env.ALLOWED_GUILD_IDS;

    // Get services from the container
    wanderingService = container.wanderingService;
    mockDiscordService = container.discordService as jest.Mocked<DiscordService>;
    mockClient = mockDiscordService.getClient() as jest.Mocked<Client>;

    // Spy on sendMessage and mock its implementation
    jest.spyOn(mockDiscordService, 'sendMessage').mockResolvedValue(true);
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

    // Add guilds to the client's cache
    mockClient.guilds.cache.set(guild1.id, guild1);
    mockClient.guilds.cache.set(guild2.id, guild2);
    mockClient.guilds.cache.set(guild3.id, guild3);
    mockClient.guilds.cache.set(guild4.id, guild4);

    // Act: Trigger the wandering message logic
    // We access the private method for a direct and predictable test
    await (wanderingService as any).runDecisionCycle();

    // Assert: Check that sendMessage was called only once per cycle (anti-spam protection)
    // New behavior: Only one message per cycle to prevent mass messaging incidents
    expect(mockDiscordService.sendMessage).toHaveBeenCalledTimes(1);

    // Check that exactly one message was sent to one of the eligible channels (anti-spam protection)
    const allCalls = (mockDiscordService.sendMessage as jest.Mock).mock.calls;
    expect(allCalls).toHaveLength(1);
    
    // Verify the message was sent to an eligible channel
    const sentChannelId = allCalls[0][0];
    const eligibleChannelIds = ['c1', 'c2', 'c4', 'c5', 'c9']; // All eligible channels across all guilds
    expect(eligibleChannelIds).toContain(sentChannelId);
    
    // Verify appropriate message was sent based on channel
    const sentMessage = allCalls[0][1];
    if (sentChannelId === 'c9') {
      // goblin channel gets special message
      expect(sentMessage).toBe('Grrraaaah!');
    } else {
      // other channels get general message  
      expect(sentMessage).toBe('Hello there!');
    }
    
    // Check that no messages were sent to ineligible channels
    expect(mockDiscordService.sendMessage).not.toHaveBeenCalledWith('c3', expect.any(String));
    expect(mockDiscordService.sendMessage).not.toHaveBeenCalledWith('c6', expect.any(String));
    expect(mockDiscordService.sendMessage).not.toHaveBeenCalledWith('c7', expect.any(String));
    expect(mockDiscordService.sendMessage).not.toHaveBeenCalledWith('c8', expect.any(String));
  });
});