import { NotificationService } from '../notification.service';
import { DiscordService } from '../discord.service';
import { ChannelDiscoveryService } from '../channel-discovery.service';
import { ConfigService } from '../config.service';
import { Guild, User, Client, TextChannel, EmbedBuilder } from 'discord.js';

// Mock Discord.js modules
jest.mock('discord.js', () => ({
  ...jest.requireActual('discord.js'),
  EmbedBuilder: jest.fn().mockImplementation(() => ({
    setColor: jest.fn().mockReturnThis(),
    setTitle: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    addFields: jest.fn().mockReturnThis(),
    setTimestamp: jest.fn().mockReturnThis(),
    setFooter: jest.fn().mockReturnThis(),
  })),
  Colors: {
    Green: 0x00ff00,
    Red: 0xff0000,
  },
}));

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let mockDiscordService: jest.Mocked<DiscordService>;
  let mockChannelDiscoveryService: jest.Mocked<ChannelDiscoveryService>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockGuild: jest.Mocked<Guild>;
  let mockUser: jest.Mocked<User>;
  let mockClient: jest.Mocked<Client>;

  beforeEach(() => {
    // Create mocks
    mockConfigService = {
      get: jest.fn(),
    } as any;

    mockUser = {
      id: 'user123',
      send: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockClient = {
      users: {
        fetch: jest.fn().mockResolvedValue(mockUser),
      },
      guilds: {
        cache: {
          size: 5,
        },
      },
    } as any;

    mockDiscordService = {
      getClient: jest.fn().mockReturnValue(mockClient),
    } as any;

    mockChannelDiscoveryService = {
      discoverEligibleChannels: jest.fn(),
    } as any;

    mockGuild = {
      id: 'guild123',
      name: 'Test Guild',
      memberCount: 100,
      ownerId: 'owner123',
    } as any;

    notificationService = new NotificationService(
      mockDiscordService,
      mockChannelDiscoveryService,
      mockConfigService
    );
  });

  describe('notifyBotOwnerOnGuildJoin', () => {
    it('should send rich embed notification when bot owner ID is configured', async () => {
      mockConfigService.get.mockReturnValue('owner123');

      await notificationService.notifyBotOwnerOnGuildJoin(mockGuild);

      expect(mockClient.users.fetch).toHaveBeenCalledWith('owner123');
      expect(mockUser.send).toHaveBeenCalledWith({
        embeds: [expect.any(Object)],
      });
      expect(EmbedBuilder).toHaveBeenCalled();
    });

    it('should not send notification when bot owner ID is not configured', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      await notificationService.notifyBotOwnerOnGuildJoin(mockGuild);

      expect(mockClient.users.fetch).not.toHaveBeenCalled();
      expect(mockUser.send).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockConfigService.get.mockReturnValue('owner123');
      (mockClient.users.fetch as jest.Mock).mockRejectedValue(new Error('User not found'));

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await notificationService.notifyBotOwnerOnGuildJoin(mockGuild);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send DM to user owner123:'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('notifyBotOwnerOnGuildLeave', () => {
    it('should send rich embed notification when bot owner ID is configured', async () => {
      mockConfigService.get.mockReturnValue('owner123');

      await notificationService.notifyBotOwnerOnGuildLeave(mockGuild);

      expect(mockClient.users.fetch).toHaveBeenCalledWith('owner123');
      expect(mockUser.send).toHaveBeenCalledWith({
        embeds: [expect.any(Object)],
      });
      expect(EmbedBuilder).toHaveBeenCalled();
    });

    it('should not send notification when bot owner ID is not configured', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      await notificationService.notifyBotOwnerOnGuildLeave(mockGuild);

      expect(mockClient.users.fetch).not.toHaveBeenCalled();
      expect(mockUser.send).not.toHaveBeenCalled();
    });
  });

  describe('checkAndNotifyGuildOwnerOnJoin', () => {
    it('should send notification to guild owner when no eligible channels found', async () => {
      mockChannelDiscoveryService.discoverEligibleChannels.mockReturnValue([]);

      await notificationService.checkAndNotifyGuildOwnerOnJoin(mockGuild);

      expect(mockChannelDiscoveryService.discoverEligibleChannels).toHaveBeenCalledWith(mockGuild);
      expect(mockClient.users.fetch).toHaveBeenCalledWith('owner123');
      expect(mockUser.send).toHaveBeenCalledWith({
        content: expect.stringContaining('Hi! 👋'),
      });
    });

    it('should not send notification when eligible channels are found', async () => {
      const mockChannel = { id: 'channel123', name: 'general' } as TextChannel;
      mockChannelDiscoveryService.discoverEligibleChannels.mockReturnValue([mockChannel]);

      await notificationService.checkAndNotifyGuildOwnerOnJoin(mockGuild);

      expect(mockChannelDiscoveryService.discoverEligibleChannels).toHaveBeenCalledWith(mockGuild);
      expect(mockClient.users.fetch).not.toHaveBeenCalled();
      expect(mockUser.send).not.toHaveBeenCalled();
    });

    it('should not send duplicate notifications to the same guild', async () => {
      mockChannelDiscoveryService.discoverEligibleChannels.mockReturnValue([]);

      // First call should send notification
      await notificationService.checkAndNotifyGuildOwnerOnJoin(mockGuild);
      expect(mockUser.send).toHaveBeenCalledTimes(1);

      // Second call should not send notification
      await notificationService.checkAndNotifyGuildOwnerOnJoin(mockGuild);
      expect(mockUser.send).toHaveBeenCalledTimes(1);
    });

    it('should handle missing guild owner gracefully', async () => {
      const guildWithoutOwner = {
        ...mockGuild,
        ownerId: null,
      } as any;
      mockChannelDiscoveryService.discoverEligibleChannels.mockReturnValue([]);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await notificationService.checkAndNotifyGuildOwnerOnJoin(guildWithoutOwner);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No valid target user found')
      );

      consoleSpy.mockRestore();
    });

    it('should handle DM failures gracefully', async () => {
      mockChannelDiscoveryService.discoverEligibleChannels.mockReturnValue([]);
      mockUser.send.mockRejectedValue(new Error('Cannot send messages to this user'));

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await notificationService.checkAndNotifyGuildOwnerOnJoin(mockGuild);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send DM to user'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('clearGuildNotification', () => {
    it('should allow re-sending notifications after clearing', async () => {
      mockChannelDiscoveryService.discoverEligibleChannels.mockReturnValue([]);

      // Send initial notification
      await notificationService.checkAndNotifyGuildOwnerOnJoin(mockGuild);
      expect(mockUser.send).toHaveBeenCalledTimes(1);

      // Try to send again (should be blocked)
      await notificationService.checkAndNotifyGuildOwnerOnJoin(mockGuild);
      expect(mockUser.send).toHaveBeenCalledTimes(1);

      // Clear and try again (should work)
      notificationService.clearGuildNotification(mockGuild.id);
      await notificationService.checkAndNotifyGuildOwnerOnJoin(mockGuild);
      expect(mockUser.send).toHaveBeenCalledTimes(2);
    });
  });

  describe('getStats', () => {
    it('should return notification statistics', async () => {
      mockChannelDiscoveryService.discoverEligibleChannels.mockReturnValue([]);

      const initialStats = notificationService.getStats();
      expect(initialStats.notificationsSent).toBe(0);

      await notificationService.checkAndNotifyGuildOwnerOnJoin(mockGuild);

      const updatedStats = notificationService.getStats();
      expect(updatedStats.notificationsSent).toBe(1);
    });
  });

  describe('createSetupMessage', () => {
    it('should create user-friendly setup message', async () => {
      mockChannelDiscoveryService.discoverEligibleChannels.mockReturnValue([]);

      await notificationService.checkAndNotifyGuildOwnerOnJoin(mockGuild);

      expect(mockUser.send).toHaveBeenCalledWith({
        content: expect.stringMatching(/Hi! 👋.*Test Guild.*View Channels.*Send Messages.*Read Message History/s),
      });
    });
  });
});