// Jest setup file for common test configuration
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
});

// Mock environment variables for tests
process.env.DISCORD_TOKEN = 'test_token';
process.env.GUILD_ID = 'test_guild_id';
process.env.QUOTES_FILE = 'quotes.yaml';