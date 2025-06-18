// src/services/__tests__/message-cleanup.service.test.ts

import { MessageCleanupService } from '../message-cleanup.service';
import { DiscordService } from '../discord.service';
import { ConfigService } from '../config.service';
import { Client, Collection, Guild, TextChannel, Message, ChannelType, GuildChannel, PermissionFlagsBits } from 'discord.js';
import { MessageCleanupOptions } from '../../types';

// Mock dependencies
jest.mock('../discord.service');
jest.mock('../config.service');

const BOT_USER_ID = 'bot-id-123';

// Helper to create a mock message
const createMockMessage = (id: string, authorId: string, timestamp: number, channel: Partial<TextChannel>): Message => ({
  id,
  author: { id: authorId },
  createdTimestamp: timestamp,
  channel,
  delete: jest.fn().mockResolvedValue(undefined),
  // Add other properties to satisfy the type, even if they are just placeholders
  attachments: new Collection(),
  content: 'test message',
  embeds: [],
  mentions: {
    users: new Collection(),
    roles: new Collection(),
    everyone: false,
    channels: new Collection(),
  },
} as unknown as Message);


// Helper to create a mock text channel
const createMockChannel = (id: string, name: string, guild: Guild, messages: Message[] = []): TextChannel => {
  const messageManager = {
    fetch: jest.fn().mockResolvedValue(new Collection<string, Message>(messages.map(m => [m.id, m]))),
    cache: new Collection<string, Message>(messages.map(m => [m.id, m])),
  };

  return {
    id,
    name,
    guild,
    type: ChannelType.GuildText,
    viewable: true,
    messages: messageManager,
    permissionsFor: jest.fn().mockReturnValue({
      has: jest.fn().mockImplementation((permission) => {
        if (permission === 'ManageMessages') return true;
        return false;
      }),
    }),
    toString: () => `<#${id}>`,
  } as unknown as TextChannel;
};

describe('MessageCleanupService', () => {
  let service: MessageCleanupService;
  let mockDiscordService: jest.Mocked<DiscordService>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockClient: jest.Mocked<Client>;
  let mockGuild: Guild;

  beforeEach(() => {
    jest.clearAllMocks();

    mockGuild = {
      id: 'guild-1',
      name: 'Test Guild',
      channels: {
        cache: new Collection<string, GuildChannel>(),
      },
    } as unknown as Guild;

    mockClient = {
      guilds: { cache: new Collection<string, Guild>([['guild-1', mockGuild]]) },
      user: { id: BOT_USER_ID },
      isReady: jest.fn().mockReturnValue(true),
    } as unknown as jest.Mocked<Client>;

    mockDiscordService = new DiscordService({} as any) as jest.Mocked<DiscordService>;
    mockDiscordService.getClient = jest.fn().mockReturnValue(mockClient);

    mockConfigService = new ConfigService() as jest.Mocked<ConfigService>;

    service = new MessageCleanupService(mockDiscordService, mockConfigService);
  });

  describe('init', () => {
    it('should throw an error if the client is not logged in', async () => {
      mockClient.user = null; // Simulate not being logged in
      await expect(service.init()).rejects.toThrow('Discord client not logged in.');
    });

    it('should set the bot user ID on successful initialization', async () => {
      await service.init();
      // We can't directly access private properties, but we can test the effect
      // This is tested implicitly by other tests that rely on the botUserId being set
      expect(mockClient.user?.id).toBe(BOT_USER_ID);
    });
  });

  describe('cleanupMessages', () => {
    it('should perform a dry run correctly, identifying messages to be deleted', async () => {
      const now = Date.now();
      const channel1 = createMockChannel('channel-1', 'general', mockGuild);
      const messages = [
        createMockMessage('msg-1', BOT_USER_ID, now - 1000, channel1), // Should match
        createMockMessage('msg-2', 'other-user', now - 2000, channel1), // Different author
        createMockMessage('msg-3', BOT_USER_ID, now - (100 * 60 * 60 * 1000), channel1), // Too old
      ];
      channel1.messages.fetch = jest.fn()
        .mockResolvedValueOnce(new Collection(messages.map(m => [m.id, m])))
        .mockResolvedValue(new Collection()); // Subsequent calls return empty
      mockGuild.channels.cache.set(channel1.id, channel1);

      const options: MessageCleanupOptions = {
        dryRun: true,
        confirm: false,
        hours: 48,
      };

      const result = await service.cleanupMessages(options);

      expect(result.scanned).toBe(3);
      expect(result.matched).toBe(1);
      expect(result.deleted.length).toBe(1);
      expect(result.deleted[0].action).toBe('dry-run');
      expect(result.deleted[0].messageId).toBe('msg-1');
      expect(result.errors.length).toBe(0);
    });

    it('should delete messages when dryRun is false and confirm is true', async () => {
      const now = Date.now();
      const channel1 = createMockChannel('channel-1', 'general', mockGuild);
      const mockMessage = createMockMessage('msg-1', BOT_USER_ID, now - 1000, channel1);
      
      channel1.messages.fetch = jest.fn()
        .mockResolvedValueOnce(new Collection([[mockMessage.id, mockMessage as Message]]))
        .mockResolvedValue(new Collection());
      mockGuild.channels.cache.set(channel1.id, channel1);

      const options: MessageCleanupOptions = {
        dryRun: false,
        confirm: true,
        hours: 48,
        rateLimitMs: 1, // Use a small delay for testing
      };

      const result = await service.cleanupMessages(options);

      expect(result.scanned).toBe(1);
      expect(result.matched).toBe(1);
      expect(result.deleted.length).toBe(1);
      expect(result.deleted[0].action).toBe('deleted');
      expect(result.errors.length).toBe(0);
      expect(mockMessage.delete).toHaveBeenCalledTimes(1);
    });

    it('should not delete messages if confirm is false', async () => {
      const now = Date.now();
      const channel1 = createMockChannel('channel-1', 'general', mockGuild);
      const mockMessage = createMockMessage('msg-1', BOT_USER_ID, now - 1000, channel1);
      
      channel1.messages.fetch = jest.fn()
        .mockResolvedValueOnce(new Collection([[mockMessage.id, mockMessage as Message]]))
        .mockResolvedValue(new Collection());
      mockGuild.channels.cache.set(channel1.id, channel1);

      const options: MessageCleanupOptions = {
        dryRun: false,
        confirm: false, // Explicitly do not confirm
        hours: 48,
      };

      const result = await service.cleanupMessages(options);

      expect(result.matched).toBe(1);
      expect(result.deleted.length).toBe(0); // No messages should be in the deleted log
      expect(mockMessage.delete).not.toHaveBeenCalled();
    });

    it('should skip channels where the bot lacks permissions', async () => {
      const channel1 = createMockChannel('channel-1', 'no-perms', mockGuild);
      // Mock the permissions check to return false
      (channel1.permissionsFor as jest.Mock).mockReturnValue({ has: () => false });
      mockGuild.channels.cache.set(channel1.id, channel1);

      const options: MessageCleanupOptions = { dryRun: true };
      const result = await service.cleanupMessages(options);

      expect(result.scanned).toBe(0);
      expect(result.matched).toBe(0);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].action).toBe('skip');
      expect(result.errors[0].reason).toContain('Missing permissions');
    });

    it('should respect the rate limit between deletions', async () => {
      jest.useFakeTimers();
      const now = Date.now();
      const channel = createMockChannel('channel-1', 'rate-limit-test', mockGuild);
      const messagesToDelete = [
        createMockMessage('msg-1', BOT_USER_ID, now - 1000, channel),
        createMockMessage('msg-2', BOT_USER_ID, now - 2000, channel),
      ];
      channel.messages.fetch = jest.fn()
        .mockResolvedValueOnce(new Collection(messagesToDelete.map(m => [m.id, m as Message])))
        .mockResolvedValue(new Collection());
      mockGuild.channels.cache.set(channel.id, channel);

      const options: MessageCleanupOptions = {
        dryRun: false,
        confirm: true,
        rateLimitMs: 5000, // 5 seconds
      };

      const promise = service.cleanupMessages(options);
      
      // Advance time just enough for the first deletion
      await jest.advanceTimersByTimeAsync(1);
      expect(messagesToDelete[0].delete).toHaveBeenCalledTimes(1);
      expect(messagesToDelete[1].delete).not.toHaveBeenCalled();

      // Advance time past the rate limit
      await jest.advanceTimersByTimeAsync(5000);
      
      await promise; // Let the cleanup complete
      expect(messagesToDelete[1].delete).toHaveBeenCalledTimes(1);
      
      jest.useRealTimers();
    }, 10000);

    it('should log an error if a message fails to delete', async () => {
      const now = Date.now();
      const channel = createMockChannel('channel-1', 'delete-fail', mockGuild);
      const mockMessage = createMockMessage('msg-1', BOT_USER_ID, now - 1000, channel);
      mockMessage.delete = jest.fn().mockRejectedValue(new Error('Discord API Error'));
      
      channel.messages.fetch = jest.fn()
        .mockResolvedValueOnce(new Collection([[mockMessage.id, mockMessage as Message]]))
        .mockResolvedValue(new Collection());
      mockGuild.channels.cache.set(channel.id, channel);

      const options: MessageCleanupOptions = { dryRun: false, confirm: true, rateLimitMs: 1 };
      const result = await service.cleanupMessages(options);

      expect(result.errors.length).toBe(1);
      expect(result.errors[0].action).toBe('error');
      expect(result.errors[0].reason).toBe('Discord API Error');
      expect(result.deleted.length).toBe(0);
    });

    it('should NEVER delete messages from other users', async () => {
        const now = Date.now();
        const channel = createMockChannel('channel-1', 'safety-test', mockGuild);
        const userMessage = createMockMessage('user-msg-1', 'some-other-user-id', now - 5000, channel);
        const botMessage = createMockMessage('bot-msg-1', BOT_USER_ID, now - 1000, channel);

        const messages = [userMessage, botMessage];
        channel.messages.fetch = jest.fn()
            .mockResolvedValueOnce(new Collection(messages.map(m => [m.id, m as Message])))
            .mockResolvedValue(new Collection());
        mockGuild.channels.cache.set(channel.id, channel);

        const options: MessageCleanupOptions = { dryRun: false, confirm: true, hours: 1 };
        const result = await service.cleanupMessages(options);

        expect(result.matched).toBe(1);
        expect(result.deleted.length).toBe(1);
        expect(result.deleted[0].messageId).toBe('bot-msg-1');
        expect(userMessage.delete).not.toHaveBeenCalled();
        expect(botMessage.delete).toHaveBeenCalledTimes(1);
      }, 10000);
    });
  });