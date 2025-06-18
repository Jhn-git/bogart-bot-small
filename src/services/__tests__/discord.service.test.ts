import { DiscordService } from '../discord.service';
import {
  mockClient,
  mockConfigService,
  createMockTextChannel,
} from '../../../tests/helpers/mocks';
import { Client } from 'discord.js';

jest.unmock('../discord.service');

// Mock the Discord.js Client constructor
jest.mock('discord.js', () => ({
  ...jest.requireActual('discord.js'),
  Client: jest.fn().mockImplementation(() => mockClient),
}));

describe('DiscordService', () => {
  let discordService: DiscordService;

  beforeEach(() => {
    jest.clearAllMocks();
    (mockConfigService.get as jest.Mock).mockReturnValue('test_token');
    discordService = new DiscordService(mockConfigService);
  });

  it('should login with the token from the config service', async () => {
    (mockClient.login as jest.Mock).mockResolvedValue(undefined);
    await discordService.login();
    expect(mockClient.login).toHaveBeenCalledWith('test_token');
  });

  it('should send a message to a channel', async () => {
    const mockChannel = createMockTextChannel('test_channel_id', 'test-channel');
    (mockClient.channels.fetch as jest.Mock).mockResolvedValue(mockChannel);
    await discordService.sendMessage('test_channel_id', 'test_message');
    expect(mockClient.channels.fetch).toHaveBeenCalledWith('test_channel_id');
    expect(mockChannel.send).toHaveBeenCalledWith('test_message');
  });

  it('should not send a message if the channel is not a text channel', async () => {
    (mockClient.channels.fetch as jest.Mock).mockResolvedValue({} as any);
    const consoleWarnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => {});
    await discordService.sendMessage('test_channel_id', 'test_message');
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Channel test_channel_id is not a text channel.',
    );
    consoleWarnSpy.mockRestore();
  });
});