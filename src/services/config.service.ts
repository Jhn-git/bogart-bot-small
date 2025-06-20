import dotenv from 'dotenv';
import fs from 'fs';
import yaml from 'js-yaml';
import { Config, Quotes } from '../types';

export class ConfigService {
  private readonly config: Config;

  constructor() {
    dotenv.config();

    // Debug logging (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.log('=== ConfigService Debug ===');
      console.log('Working directory:', process.cwd());
      console.log('QUOTES_FILE env var:', process.env.QUOTES_FILE);
      console.log('NODE_ENV:', process.env.NODE_ENV);
    }

    let quotesPath = process.env.QUOTES_FILE || 'data/quotes.yaml';
    
    // Handle relative paths and ensure we look in the right location
    if (!fs.existsSync(quotesPath)) {
      const alternativePaths = [
        'data/quotes.yaml',
        '/app/data/quotes.yaml',
        './data/quotes.yaml',
        '../data/quotes.yaml'
      ] as const;
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`Initial path ${quotesPath} not found, trying alternatives...`);
      }
      
      for (const altPath of alternativePaths) {
        if (fs.existsSync(altPath)) {
          if (process.env.NODE_ENV === 'development') {
            console.log(`Found quotes file at: ${altPath}`);
          }
          quotesPath = altPath;
          break;
        }
      }
      
      if (!fs.existsSync(quotesPath)) {
        console.error(`Could not find quotes file. Tried paths:`, [quotesPath, ...alternativePaths]);
        console.error(`Current working directory: ${process.cwd()}`);
        console.error(`QUOTES_FILE environment variable: ${process.env.QUOTES_FILE}`);
        throw new Error(`Could not find quotes file at any expected location`);
      }
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`Loading quotes from: ${quotesPath}`);
    }
    const quotesFile = fs.readFileSync(quotesPath, 'utf8');
    const quotes = yaml.load(quotesFile) as Quotes;

    // Validate environment variables
    const discordToken = process.env.DISCORD_TOKEN?.trim();
    if (!discordToken) {
      throw new Error('DISCORD_TOKEN is not defined in the environment variables.');
    }

    // Validate cleanup max messages
    const cleanupMaxMessagesStr = process.env.CLEANUP_MAX_MESSAGES_PER_CHANNEL || '100';
    const cleanupMaxMessages = parseInt(cleanupMaxMessagesStr, 10);
    if (isNaN(cleanupMaxMessages) || cleanupMaxMessages < 1 || cleanupMaxMessages > 1000) {
      throw new Error(`CLEANUP_MAX_MESSAGES_PER_CHANNEL must be a number between 1 and 1000, got: ${cleanupMaxMessagesStr}`);
    }

    // Get bot owner ID (optional)
    const botOwnerId = process.env.BOT_OWNER_ID?.trim();

    // Get scoring parameters with defaults from refine.md recommendations
    const minScoreThresholdStr = process.env.MIN_SCORE_THRESHOLD || '30';
    const minScoreThreshold = parseInt(minScoreThresholdStr, 10);
    if (isNaN(minScoreThreshold) || minScoreThreshold < 1 || minScoreThreshold > 200) {
      throw new Error(`MIN_SCORE_THRESHOLD must be a number between 1 and 200, got: ${minScoreThresholdStr}`);
    }

    const lonelinessBonusStr = process.env.LONELINESS_BONUS_POINTS_PER_DAY || '15';
    const lonelinessBonusPointsPerDay = parseInt(lonelinessBonusStr, 10);
    if (isNaN(lonelinessBonusPointsPerDay) || lonelinessBonusPointsPerDay < 0 || lonelinessBonusPointsPerDay > 100) {
      throw new Error(`LONELINESS_BONUS_POINTS_PER_DAY must be a number between 0 and 100, got: ${lonelinessBonusStr}`);
    }

    // Validate quotes structure
    if (!quotes || typeof quotes !== 'object') {
      throw new Error('Invalid quotes configuration: quotes must be an object');
    }

    if (!Array.isArray(quotes.generic_wandering_messages)) {
      throw new Error('Invalid quotes configuration: generic_wandering_messages must be an array');
    }

    if (quotes.generic_wandering_messages.length === 0) {
      throw new Error('Invalid quotes configuration: generic_wandering_messages cannot be empty');
    }

    if (quotes.goblin_wandering_messages && typeof quotes.goblin_wandering_messages !== 'object') {
      throw new Error('Invalid quotes configuration: goblin_wandering_messages must be an object');
    }

    this.config = {
      discordToken,
      quotes,
      cleanupMaxMessages,
      botOwnerId,
      minScoreThreshold,
      lonelinessBonusPointsPerDay,
    };
  }

  public get<K extends keyof Config>(key: K): Config[K] {
    return this.config[key];
  }
}
