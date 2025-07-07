// src/services/__tests__/message-cleanup.service.test.ts

import { MessageCleanupService } from '../message-cleanup.service';
import { DiscordService } from '../discord.service';
import { ConfigService } from '../config.service';
import { GuildService } from '../guild.service';
import { Client, Collection, Guild, TextChannel, Message, ChannelType, GuildChannel } from 'discord.js';
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
  let mockGuildService: jest.Mocked<GuildService>;
  let mockClient: jest.Mocked<Client>;
  let mockGuild: Guild;
  let delaySpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Spy on the private delay method
    delaySpy = jest.spyOn(MessageCleanupService.prototype as any, 'delay').mockResolvedValue(undefined);

    mockGuild = {
      id: 'guild-1',
      name: 'Test Guild',
      channels: {
        cache: new Collection<string, GuildChannel>(),
        fetch: jest.fn().mockResolvedValue(new Collection()),
      },
    } as unknown as Guild;

    // Mock the fetch method to return the guild itself, as per discord.js behavior
    (mockGuild as any).fetch = jest.fn().mockResolvedValue(mockGuild);

    mockClient = {
      guilds: { cache: new Collection<string, Guild>([['guild-1', mockGuild]]) },
      user: { id: BOT_USER_ID },
      isReady: jest.fn().mockReturnValue(true),
    } as unknown as jest.Mocked<Client>;

    const mockDatabaseService = { recordGuildJoin: jest.fn() } as any;
    mockDiscordService = new DiscordService({} as any, mockDatabaseService) as jest.Mocked<DiscordService>;
    mockDiscordService.getClient = jest.fn().mockReturnValue(mockClient);

    mockConfigService = new ConfigService() as jest.Mocked<ConfigService>;

    mockGuildService = {
      getAllGuilds: jest.fn().mockReturnValue([mockGuild]),
      getGuildById: jest.fn(),
      discoverGuilds: jest.fn().mockReturnValue([mockGuild]),
      isGuildAllowed: jest.fn().mockReturnValue(true),
      getAllowedGuildIds: jest.fn().mockReturnValue([]),
    } as unknown as jest.Mocked<GuildService>;

    service = new MessageCleanupService(mockDiscordService, mockConfigService, mockGuildService);
  });

  afterEach(() => {
    delaySpy.mockRestore();
  });

  describe('init', () => {
    it('should throw an error if the client is not logged in', async () => {
      mockClient.user = null; // Simulate not being logged in
      await expect(service.init()).rejects.toThrow('Discord client not logged in.');
    });

    it('should set the bot user ID on successful initialization', async () => {
      await service.init();
      expect(mockClient.user?.id).toBe(BOT_USER_ID);
    });
  });

  describe('cleanupMessages', () => {
    it('should perform a dry run correctly, identifying messages to be deleted', async () => {
      const now = Date.now();
      const channel1 = createMockChannel('channel-1', 'general', mockGuild);
      const messages = [
        createMockMessage('msg-1', BOT_USER_ID, now - 1000, channel1),
        createMockMessage('msg-2', 'other-user', now - 2000, channel1),
        createMockMessage('msg-3', BOT_USER_ID, now - (100 * 60 * 60 * 1000), channel1),
      ];
      channel1.messages.fetch = jest.fn()
        .mockResolvedValueOnce(new Collection(messages.map(m => [m.id, m])))
        .mockResolvedValue(new Collection());
      mockGuild.channels.cache.set(channel1.id, channel1);

      const options: MessageCleanupOptions = { dryRun: true, hours: 48 };
      const result = await service.cleanupMessages(options);

      expect(result.scanned).toBe(3);
      expect(result.matched).toBe(1);
      expect(result.deleted.length).toBe(1);
      expect(result.deleted[0].action).toBe('dry-run');
    });

    it('should delete messages when dryRun is false and confirm is true', async () => {
      const now = Date.now();
      const channel1 = createMockChannel('channel-1', 'general', mockGuild);
      const mockMessage = createMockMessage('msg-1', BOT_USER_ID, now - 1000, channel1);
      
      channel1.messages.fetch = jest.fn()
        .mockResolvedValueOnce(new Collection([[mockMessage.id, mockMessage as Message]]))
        .mockResolvedValue(new Collection());
      mockGuild.channels.cache.set(channel1.id, channel1);

      const options: MessageCleanupOptions = { dryRun: false, confirm: true, hours: 48, rateLimitMs: 1 };
      const result = await service.cleanupMessages(options);

      expect(result.deleted.length).toBe(1);
      expect(result.deleted[0].action).toBe('deleted');
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

      const options: MessageCleanupOptions = { dryRun: false, confirm: false, hours: 48 };
      const result = await service.cleanupMessages(options);

      expect(result.deleted.length).toBe(0);
      expect(mockMessage.delete).not.toHaveBeenCalled();
    });

    it('should skip channels where the bot lacks permissions', async () => {
      const channel1 = createMockChannel('channel-1', 'no-perms', mockGuild);
      (channel1.permissionsFor as jest.Mock).mockReturnValue({ has: () => false });
      mockGuild.channels.cache.set(channel1.id, channel1);

      const options: MessageCleanupOptions = { dryRun: true };
      const result = await service.cleanupMessages(options);

      // With the new pre-filtering logic, channels without permissions are filtered out
      // before processing, so no errors are logged for them
      expect(result.errors.length).toBe(0);
      expect(result.scanned).toBe(0);
      expect(result.matched).toBe(0);
    });

    it('should call the delay function between deletions', async () => {
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

        const options: MessageCleanupOptions = { dryRun: false, confirm: true, rateLimitMs: 500 };
        await service.cleanupMessages(options);

        expect(delaySpy).toHaveBeenCalledTimes(2);
        expect(delaySpy).toHaveBeenCalledWith(500);
    });

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

        const options: MessageCleanupOptions = { dryRun: false, confirm: true, hours: 1, rateLimitMs: 1 };
        const result = await service.cleanupMessages(options);

        expect(result.deleted.length).toBe(1);
        expect(result.deleted[0].messageId).toBe('bot-msg-1');
        expect(userMessage.delete).not.toHaveBeenCalled();
        expect(botMessage.delete).toHaveBeenCalledTimes(1);
    });
it('should respect the cleanupMaxMessages limit from ConfigService', async () => {
      const maxMessages = 50;
      (mockConfigService.get as jest.Mock).mockReturnValue(maxMessages);

      const channel = createMockChannel('channel-1', 'limit-test', mockGuild);
      const messages = Array.from({ length: 100 }, (_, i) =>
        createMockMessage(`msg-${i}`, BOT_USER_ID, Date.now() - 1000 * i, channel)
      );

      // Mock fetch to return messages in batches
      channel.messages.fetch = jest.fn()
        .mockResolvedValueOnce(new Collection(messages.slice(0, 50).map(m => [m.id, m])))
        .mockResolvedValueOnce(new Collection(messages.slice(50, 100).map(m => [m.id, m])))
        .mockResolvedValue(new Collection());

      mockGuild.channels.cache.set(channel.id, channel);

      const options: MessageCleanupOptions = { dryRun: true, hours: 48, batchSize: 50 };
      const result = await service.cleanupMessages(options);

      expect(result.scanned).toBe(maxMessages);
      expect(channel.messages.fetch).toHaveBeenCalledTimes(1);
    });
  });
});