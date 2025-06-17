import { DiscordService } from '../discord.service';
import { ConfigService } from '../config.service';
import { Client, TextChannel } from 'discord.js';

jest.mock('discord.js', () => {
  class MockTextChannel {
    send = jest.fn();
  }
  const mockClient = {
    login: jest.fn(),
    on: jest.fn(),
    channels: {
      fetch: jest.fn(),
    },
    user: {
      tag: 'test-bot',
    },
  };
  return {
    Client: jest.fn(() => mockClient),
    TextChannel: MockTextChannel,
    GatewayIntentBits: { Guilds: 1, GuildMessages: 512 },
  };
});

describe('DiscordService', () => {
  let configService: ConfigService;
  let discordService: DiscordService;
  let mockClient: jest.Mocked<Client>;

  beforeEach(() => {
    configService = new ConfigService();
    jest.spyOn(configService, 'get').mockReturnValue('test_token');
    discordService = new DiscordService(configService);
    mockClient = new (Client as any)();
  });

  it('should login with the token from the config service', async () => {
    await discordService.login();
    expect(mockClient.login).toHaveBeenCalledWith('test_token');
  });

  it('should send a message to a channel', async () => {
    const mockChannel = new (TextChannel as any)();
    (mockClient.channels.fetch as jest.Mock).mockResolvedValue(mockChannel);
    await discordService.sendMessage('test_channel_id', 'test_message');
    expect(mockClient.channels.fetch).toHaveBeenCalledWith('test_channel_id');
    expect(mockChannel.send).toHaveBeenCalledWith('test_message');
  });

  it('should not send a message if the channel is not a text channel', async () => {
    (mockClient.channels.fetch as jest.Mock).mockResolvedValue({} as any); // Not an instance of our mock TextChannel
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await discordService.sendMessage('test_channel_id', 'test_message');
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Channel test_channel_id is not a text channel.',
    );
    consoleWarnSpy.mockRestore();
  });
});