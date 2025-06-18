// src/services/__tests__/guild.service.test.ts

import { GuildService } from '../guild.service';
import { DiscordService } from '../discord.service';
import { Client, Collection, Guild } from 'discord.js';

// Mock DiscordService
jest.mock('../discord.service');

describe('GuildService', () => {
  let mockDiscordService: jest.Mocked<DiscordService>;
  let mockClient: jest.Mocked<Client>;
  let mockGuilds: Collection<string, Guild>;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };

    mockGuilds = new Collection<string, Guild>();
    mockGuilds.set('1', { id: '1', name: 'Guild 1' } as Guild);
    mockGuilds.set('2', { id: '2', name: 'Guild 2' } as Guild);
    mockGuilds.set('1105309398705897633', { id: '1105309398705897633', name: 'Dev Guild' } as Guild);

    mockClient = {
      guilds: { cache: mockGuilds },
    } as unknown as jest.Mocked<Client>;

    mockDiscordService = {
      getClient: jest.fn().mockReturnValue(mockClient),
    } as unknown as jest.Mocked<DiscordService>;
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('when ALLOWED_GUILD_IDS is not set', () => {
    let guildService: GuildService;

    beforeEach(() => {
      delete process.env.ALLOWED_GUILD_IDS;
      guildService = new GuildService(mockDiscordService);
    });

    it('getAllGuilds should return all guilds', () => {
      const guilds = guildService.getAllGuilds();
      expect(guilds).toHaveLength(3);
      expect(guilds.map(g => g.id)).toEqual(['1', '2', '1105309398705897633']);
    });

    it('getGuildById should return a guild if it exists', () => {
      expect(guildService.getGuildById('1')?.name).toBe('Guild 1');
      expect(guildService.getGuildById('3')).toBeUndefined();
    });

    it('isGuildAllowed should always return true', () => {
      expect(guildService.isGuildAllowed('1')).toBe(true);
      expect(guildService.isGuildAllowed('3')).toBe(true);
    });

    it('getAllowedGuildIds should return an empty array', () => {
      expect(guildService.getAllowedGuildIds()).toEqual([]);
    });
  });

  describe('when ALLOWED_GUILD_IDS is set', () => {
    let guildService: GuildService;
    const devGuildId = '1105309398705897633';

    beforeEach(() => {
      process.env.ALLOWED_GUILD_IDS = `1, ${devGuildId}`;
      guildService = new GuildService(mockDiscordService);
    });

    it('getAllGuilds should return only allowed guilds', () => {
      const guilds = guildService.getAllGuilds();
      expect(guilds).toHaveLength(2);
      expect(guilds.map(g => g.id)).toEqual(['1', devGuildId]);
    });

    it('getGuildById should only return allowed guilds', () => {
      expect(guildService.getGuildById('1')?.name).toBe('Guild 1');
      expect(guildService.getGuildById(devGuildId)?.name).toBe('Dev Guild');
      expect(guildService.getGuildById('2')).toBeUndefined();
    });

    it('isGuildAllowed should return true for allowed guilds and false for others', () => {
      expect(guildService.isGuildAllowed('1')).toBe(true);
      expect(guildService.isGuildAllowed(devGuildId)).toBe(true);
      expect(guildService.isGuildAllowed('2')).toBe(false);
      expect(guildService.isGuildAllowed('3')).toBe(false);
    });

    it('getAllowedGuildIds should return the correct list of IDs', () => {
      expect(guildService.getAllowedGuildIds()).toEqual(['1', devGuildId]);
    });

    it('discoverGuilds should only return allowed guilds', () => {
      const guilds = guildService.discoverGuilds();
      expect(guilds).toHaveLength(2);
      expect(guilds.map(g => g.id)).toEqual(['1', devGuildId]);
    });
  });
});