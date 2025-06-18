// src/services/__tests__/guild.service.test.ts

import { GuildService } from '../guild.service';
import { DiscordService } from '../discord.service';
import { Client, Collection, Guild } from 'discord.js';

// Mock DiscordService
jest.mock('../discord.service');

describe('GuildService', () => {
  let guildService: GuildService;
  let mockDiscordService: jest.Mocked<DiscordService>;
  let mockClient: jest.Mocked<Client>;
  let mockGuilds: Collection<string, Guild>;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Mock Guilds
    mockGuilds = new Collection<string, Guild>();
    mockGuilds.set('1', { id: '1', name: 'Guild 1' } as Guild);
    mockGuilds.set('2', { id: '2', name: 'Guild 2' } as Guild);

    // Mock Client
    mockClient = {
      guilds: {
        cache: mockGuilds,
      },
    } as unknown as jest.Mocked<Client>;

    // Mock DiscordService instance
    mockDiscordService = new DiscordService({} as any) as jest.Mocked<DiscordService>;
    mockDiscordService.getClient = jest.fn().mockReturnValue(mockClient);

    guildService = new GuildService(mockDiscordService);
  });

  describe('getAllGuilds', () => {
    it('should return all guilds from the client cache', () => {
      const guilds = guildService.getAllGuilds();
      expect(guilds).toHaveLength(2);
      expect(guilds.map(g => g.id)).toEqual(['1', '2']);
      expect(mockDiscordService.getClient).toHaveBeenCalledTimes(1);
    });

    it('should return an empty array if there are no guilds', () => {
        mockGuilds.clear();
        const guilds = guildService.getAllGuilds();
        expect(guilds).toHaveLength(0);
    });
  });

  describe('getGuildById', () => {
    it('should return the correct guild by its ID', () => {
      const guild = guildService.getGuildById('1');
      expect(guild).toBeDefined();
      expect(guild?.id).toBe('1');
      expect(mockDiscordService.getClient).toHaveBeenCalledTimes(1);
    });

    it('should return undefined if the guild ID does not exist', () => {
      const guild = guildService.getGuildById('3');
      expect(guild).toBeUndefined();
    });
  });

  describe('discoverGuilds', () => {
    it('should return all guilds', () => {
      const guilds = guildService.discoverGuilds();
      expect(guilds).toHaveLength(2);
      expect(guilds.map(g => g.id)).toEqual(['1', '2']);
    });
  });
});