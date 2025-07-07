module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/tests/**/*.test.ts'],
  testPathIgnorePatterns: [
    '/tests/integration/main.integration.test.ts',
    '/tests/integration/multi-guild.integration.test.ts',
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/__tests__/**',
    '!src/**/*.test.ts',
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/helpers/setup.ts'],
};