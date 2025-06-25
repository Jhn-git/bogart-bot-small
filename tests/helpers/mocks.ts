import { ConfigService } from '../../src/services/config.service';
import { DiscordService } from '../../src/services/discord.service';
import { QuoteService } from '../../src/services/quote.service';
import { WanderingService } from '../../src/modules/wandering/wandering.service';
import { Client, Collection, Guild, TextChannel } from 'discord.js';
import { DatabaseService } from '../../src/services/database.service';

jest.mock('../../src/services/config.service');
jest.mock('../../src/services/discord.service');
jest.mock('../../src/services/quote.service');
jest.mock('../../src/modules/wandering/wandering.service');

export const mockConfigService = new (ConfigService as jest.Mock)();
export const mockQuoteService = new (QuoteService as jest.Mock)();
export const mockDiscordService = new (DiscordService as jest.Mock)();
export const mockWanderingService = new (WanderingService as jest.Mock)();

export const mockClient = {
  guilds: {
    cache: new Collection<string, Guild>(),
  },
  isReady: jest.fn().mockReturnValue(true),
  login: jest.fn(),
  destroy: jest.fn(),
  channels: {
    fetch: jest.fn(),
  },
  on: jest.fn(),
  user: {
    tag: 'test-bot',
  },
} as unknown as jest.Mocked<Client>;

(mockDiscordService.getClient as jest.Mock).mockReturnValue(mockClient);

export const createMockTextChannel = (id: string, name: string): TextChannel => {
  const channel = Object.create(TextChannel.prototype);
  Object.assign(channel, { id, name, send: jest.fn() });
  return channel;
};

export const createMockDatabaseService = () => {
  const mockDb = new DatabaseService() as jest.Mocked<DatabaseService>;
  mockDb.all = jest.fn().mockResolvedValue([]);
  mockDb.run = jest.fn().mockResolvedValue(undefined);
  mockDb.get = jest.fn().mockResolvedValue(undefined);
  mockDb.exec = jest.fn().mockResolvedValue(undefined);
  return mockDb;
};