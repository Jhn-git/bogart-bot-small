/**
 * Integration Tests for Bogart Discord Bot
 * 
 * These tests validate the complete system integration including:
 * - Service initialization order
 * - Configuration loading
 * - Service dependencies
 * - Error handling scenarios
 */

import { ConfigService } from '../../src/services/config.service';
import { DiscordService } from '../../src/services/discord.service';
import { QuoteService } from '../../src/services/quote.service';
import { WanderingService } from '../../src/services/wandering.service';
import fs from 'fs';
import yaml from 'js-yaml';

// Mock Discord.js to avoid actual network calls
jest.mock('discord.js', () => ({
  Client: jest.fn(() => ({
    login: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    channels: {
      fetch: jest.fn(),
    },
    guilds: {
      cache: new Map(),
    },
    isReady: jest.fn().mockReturnValue(true),
  })),
  GatewayIntentBits: { Guilds: 1, GuildMessages: 512 },
  TextChannel: class MockTextChannel {},
}));

describe('System Integration Tests', () => {
  beforeEach(() => {
    // Set up test environment variables
    process.env.DISCORD_TOKEN = 'test_token';
    process.env.GUILD_ID = 'test_guild';
    process.env.QUOTES_FILE = 'data/quotes.yaml';
  });

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  describe('Service Integration', () => {
    it('should initialize all services in correct order', () => {
      // Test that ConfigService loads first and provides config to other services
      const configService = new ConfigService();
      expect(configService.get('discordToken')).toBe('test_token');

      // Test that other services can be initialized with ConfigService
      const discordService = new DiscordService(configService);
      const quoteService = new QuoteService(configService);
      
      expect(discordService).toBeDefined();
      expect(quoteService).toBeDefined();

      // Test that WanderingService can be initialized with all dependencies
      const wanderingService = new WanderingService(
        discordService,
        quoteService,
        configService
      );
      expect(wanderingService).toBeDefined();
    });

    it('should handle configuration loading errors gracefully', () => {
      // Test missing Discord token
      delete process.env.DISCORD_TOKEN;
      
      expect(() => new ConfigService()).toThrow(
        'DISCORD_TOKEN is not defined in the environment variables.'
      );
    });

    it('should load quotes from YAML file', () => {
      const configService = new ConfigService();
      const quotes = configService.get('quotes');
      
      expect(quotes).toBeDefined();
      expect(quotes.generic_wandering_messages).toBeDefined();
      expect(Array.isArray(quotes.generic_wandering_messages)).toBe(true);
      expect(quotes.goblin_wandering_messages).toBeDefined();
    });

    it('should integrate quote service with channel mapping', () => {
      const configService = new ConfigService();
      const quoteService = new QuoteService(configService);
      
      // Test channel-specific message retrieval
      const goblinCaveMessage = quoteService.getWanderingMessage('goblin-cave');
      expect(typeof goblinCaveMessage).toBe('string');
      expect(goblinCaveMessage.length).toBeGreaterThan(0);
      
      // Test fallback to generic messages
      const genericMessage = quoteService.getWanderingMessage('unknown-channel');
      expect(typeof genericMessage).toBe('string');
      expect(genericMessage.length).toBeGreaterThan(0);
    });

    it('should handle placeholder replacement in messages', () => {
      const configService = new ConfigService();
      const quoteService = new QuoteService(configService);
      
      // Mock a message with placeholders
      const mockQuotes = {
        generic_wandering_messages: ['Hello {name}, welcome to {place}!'],
        goblin_wandering_messages: {},
      };
      
      jest.spyOn(configService, 'get').mockReturnValue(mockQuotes);
      const quoteServiceWithMock = new QuoteService(configService);
      
      const message = quoteServiceWithMock.getWanderingMessage('test-channel', {
        name: 'Bogart',
        place: 'the cave'
      });
      
      expect(message).toBe('Hello Bogart, welcome to the cave!');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle Discord service login failures', async () => {
      const configService = new ConfigService();
      const discordService = new DiscordService(configService);
      
      // Mock login failure
      const mockClient = discordService.getClient();
      (mockClient.login as jest.Mock).mockRejectedValue(new Error('Invalid token'));
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit called');
      });
      
      await expect(discordService.login()).rejects.toThrow('Process exit called');
      
      expect(consoleSpy).toHaveBeenCalledWith('Failed to log in:', expect.any(Error));
      expect(exitSpy).toHaveBeenCalledWith(1);
      
      consoleSpy.mockRestore();
      exitSpy.mockRestore();
    });

    it('should handle message sending failures gracefully', async () => {
      const configService = new ConfigService();
      const discordService = new DiscordService(configService);
      
      // Mock channel fetch failure
      const mockClient = discordService.getClient();
      (mockClient.channels.fetch as jest.Mock).mockRejectedValue(new Error('Channel not found'));
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await discordService.sendMessage('invalid_channel_id', 'test message');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to send message to channel invalid_channel_id:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Complete System Flow', () => {
    it('should simulate complete bot startup flow', () => {
      // Simulate the main.ts startup sequence
      const configService = new ConfigService();
      const discordService = new DiscordService(configService);
      const quoteService = new QuoteService(configService);
      const wanderingService = new WanderingService(
        discordService,
        quoteService,
        configService
      );
      
      // Verify all services are properly initialized
      expect(configService.get('discordToken')).toBe('test_token');
      expect(discordService.getClient()).toBeDefined();
      expect(quoteService.getWanderingMessage('test')).toBeDefined();
      
      // Test that wandering service can start (without actually running the timer)
      expect(() => wanderingService.start()).not.toThrow();
    });

    it('should validate quotes.yaml structure', () => {
      // Verify the actual quotes.yaml file structure
      const quotesContent = fs.readFileSync('data/quotes.yaml', 'utf8');
      const quotes = yaml.load(quotesContent) as any;
      
      expect(quotes).toBeDefined();
      expect(quotes.generic_wandering_messages).toBeDefined();
      expect(Array.isArray(quotes.generic_wandering_messages)).toBe(true);
      expect(quotes.generic_wandering_messages.length).toBeGreaterThan(0);
      
      expect(quotes.goblin_wandering_messages).toBeDefined();
      expect(typeof quotes.goblin_wandering_messages).toBe('object');
      
      // Verify specific channels exist
      const channels = Object.keys(quotes.goblin_wandering_messages);
      expect(channels).toContain('goblin-cave');
      expect(channels).toContain('murky-swamp');
    });
  });
});