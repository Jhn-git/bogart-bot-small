import { jest } from '@jest/globals';

// Mock environment variables for tests
process.env.DISCORD_TOKEN = 'test_token';
process.env.GUILD_ID = 'test_guild_id';
process.env.QUOTES_FILE = 'data/quotes.yaml';

beforeEach(() => {
  jest.clearAllMocks();
});

// Global mocks can be configured here if needed