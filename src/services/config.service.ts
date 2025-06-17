import dotenv from 'dotenv';
import fs from 'fs';
import yaml from 'js-yaml';
import { Config, Quotes } from '../types';

export class ConfigService {
  private readonly config: Config;

  constructor() {
    dotenv.config();

    // Debug logging
    console.log('=== ConfigService Debug ===');
    console.log('Working directory:', process.cwd());
    console.log('QUOTES_FILE env var:', process.env.QUOTES_FILE);
    console.log('NODE_ENV:', process.env.NODE_ENV);

    let quotesPath = process.env.QUOTES_FILE || 'data/quotes.yaml';
    
    // Handle relative paths and ensure we look in the right location
    if (!fs.existsSync(quotesPath)) {
      const alternativePaths = [
        'data/quotes.yaml',
        '/app/data/quotes.yaml',
        './data/quotes.yaml',
        '../data/quotes.yaml'
      ];
      
      console.log(`Initial path ${quotesPath} not found, trying alternatives...`);
      
      for (const altPath of alternativePaths) {
        if (fs.existsSync(altPath)) {
          console.log(`Found quotes file at: ${altPath}`);
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
    
    console.log(`Loading quotes from: ${quotesPath}`);
    const quotesFile = fs.readFileSync(quotesPath, 'utf8');
    const quotes = yaml.load(quotesFile) as Quotes;

    this.config = {
      discordToken: process.env.DISCORD_TOKEN || '',
      guildId: process.env.GUILD_ID || '',
      quotes,
    };

    if (!this.config.discordToken) {
      throw new Error('DISCORD_TOKEN is not defined in the environment variables.');
    }
  }

  public get<K extends keyof Config>(key: K): Config[K] {
    return this.config[key];
  }
}
