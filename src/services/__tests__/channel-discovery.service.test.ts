// src/services/__tests__/channel-discovery.service.test.ts

import { ChannelDiscoveryService } from '../channel-discovery.service';
import { ConfigService } from '../config.service';
import { Guild, Collection, PermissionsBitField, ChannelType, GuildMember } from 'discord.js';

describe('ChannelDiscoveryService', () => {
  let channelDiscoveryService: ChannelDiscoveryService;
  let mockGuild: jest.Mocked<Guild>;
  let mockChannels: Collection<string, any>;

  // Helper to create a mock channel with permissions
  const createMockChannel = (
    id: string,
    name: string,
    type: ChannelType,
    nsfw: boolean,
    canSend: boolean
  ) => {
    const channel = {
      id,
      name,
      type,
      nsfw,
      guild: mockGuild,
      permissionsFor: jest.fn(),
    };
    const permissions = new PermissionsBitField();
    if (canSend) {
      permissions.add(PermissionsBitField.Flags.SendMessages);
      permissions.add(PermissionsBitField.Flags.ReadMessageHistory);
    }
    channel.permissionsFor.mockReturnValue(permissions);
    mockChannels.set(id, channel);
  };

  beforeEach(() => {
    const mockConfigService = {
      get: jest.fn().mockReturnValue({
        goblin_wandering_messages: {
          'goblin-cave': ['Test message']
        }
      })
    } as any;
    channelDiscoveryService = new ChannelDiscoveryService(mockConfigService);
    mockChannels = new Collection<string, any>();

    mockGuild = {
      channels: {
        cache: mockChannels,
      },
      members: {
        me: {} as GuildMember,
      },
    } as unknown as jest.Mocked<Guild>;

    // Setup default channels using the helper
    createMockChannel('1', 'general', ChannelType.GuildText, false, true);
    createMockChannel('2', 'bot-commands', ChannelType.GuildText, false, true);
    createMockChannel('3', 'voice-chat', ChannelType.GuildVoice, false, true);
    createMockChannel('4', 'secret-lounge', ChannelType.GuildText, false, true);
    createMockChannel('5', 'naughty-corner', ChannelType.GuildText, true, true);
    createMockChannel('6', 'chat-no-perms', ChannelType.GuildText, false, false);
    createMockChannel('7', 'talk-to-me', ChannelType.GuildText, false, true);
  });

  it('should discover eligible channels with correct names and permissions', () => {
    const channels = channelDiscoveryService.discoverEligibleChannels(mockGuild);
    const channelNames = channels.map((c) => c.name);

    expect(channelNames).toContain('general');
    expect(channelNames).toContain('bot-commands');
    expect(channelNames).toContain('talk-to-me');
    expect(channelNames).toContain('secret-lounge'); // Now allowed with blacklist approach
    expect(channels).toHaveLength(4); // Updated count
  });

  it('should exclude channels where the bot cannot send messages', () => {
    const channels = channelDiscoveryService.discoverEligibleChannels(mockGuild);
    const channelNames = channels.map((c) => c.name);
    expect(channelNames).not.toContain('chat-no-perms');
  });

  it('should exclude NSFW channels', () => {
    const channels = channelDiscoveryService.discoverEligibleChannels(mockGuild);
    const channelNames = channels.map((c) => c.name);
    expect(channelNames).not.toContain('naughty-corner');
  });

  it('should exclude channels that are not text channels', () => {
    const channels = channelDiscoveryService.discoverEligibleChannels(mockGuild);
    const channelNames = channels.map((c) => c.name);
    expect(channelNames).not.toContain('voice-chat');
  });

  it('should exclude channels that match blocked patterns', () => {
    // Add a channel that should be blocked
    createMockChannel('8', 'rules-and-info', ChannelType.GuildText, false, true);
    createMockChannel('9', 'mod-only', ChannelType.GuildText, false, true);
    
    const channels = channelDiscoveryService.discoverEligibleChannels(mockGuild);
    const channelNames = channels.map((c) => c.name);
    
    // These should be blocked by the blacklist
    expect(channelNames).not.toContain('rules-and-info');
    expect(channelNames).not.toContain('mod-only');
    
    // These should still be allowed
    expect(channelNames).toContain('secret-lounge'); // Not in blacklist
  });

  it('should return an empty array if no channels are eligible', () => {
    mockChannels.clear();
    const channels = channelDiscoveryService.discoverEligibleChannels(mockGuild);
    expect(channels).toHaveLength(0);
  });

  it('should return an empty array if guild has channels, but none are eligible', () => {
    mockChannels.clear();
    createMockChannel('1', 'voice-1', ChannelType.GuildVoice, false, true); // Wrong type
    createMockChannel('2', 'rules-channel', ChannelType.GuildText, false, true); // Blocked pattern
    createMockChannel('3', 'no-send-channel', ChannelType.GuildText, false, false); // No permissions
    createMockChannel('4', 'adults-only', ChannelType.GuildText, true, true); // NSFW
    const channels = channelDiscoveryService.discoverEligibleChannels(mockGuild);
    expect(channels).toHaveLength(0);
  });
});