import { ConfigService } from '../services/config.service';
import { DiscordService } from '../services/discord.service';
import { QuoteService } from '../services/quote.service';
import { WanderingService } from '../services/wandering.service';
import { Client, Collection, Guild, TextChannel } from 'discord.js';

jest.mock('../services/config.service');
jest.mock('../services/discord.service');
jest.mock('../services/quote.service');
jest.mock('../services/wandering.service');

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