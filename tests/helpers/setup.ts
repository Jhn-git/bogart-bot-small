import { jest } from '@jest/globals';

// Mock environment variables for tests
process.env.DISCORD_TOKEN = 'test_token';
process.env.GUILD_ID = 'test_guild_id';
process.env.QUOTES_FILE = 'data/quotes.yaml';

beforeEach(() => {
  jest.clearAllMocks();
});

// Suppress console output during tests
const originalConsole = { ...console };

beforeAll(() => {
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
});