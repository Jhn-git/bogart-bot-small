import { ConfigService } from '../config.service';
import fs from 'fs';
import { dump } from 'js-yaml';

// Since we are now mocking the service globally, we need to test the original implementation
jest.unmock('../config.service');

describe('ConfigService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should load the discord token from environment variables', () => {
    process.env.DISCORD_TOKEN = 'test_token';
    const configService = new ConfigService();
    expect(configService.get('discordToken')).toBe('test_token');
  });

  it('should throw an error if the discord token is not defined', () => {
    delete process.env.DISCORD_TOKEN;
    expect(() => new ConfigService()).toThrow(
      'DISCORD_TOKEN is not defined in the environment variables.',
    );
  });

  it('should load and parse the quotes file', () => {
    process.env.DISCORD_TOKEN = 'test_token';
    const mockQuotes = {
      generic_wandering_messages: ['hello'],
      goblin_wandering_messages: {
        'test-channel': ['test message'],
      },
    };
    const yaml = dump(mockQuotes);
    jest.spyOn(fs, 'readFileSync').mockReturnValue(yaml);

    const configService = new ConfigService();
    expect(configService.get('quotes')).toEqual(mockQuotes);
  });
});