import dotenv from 'dotenv';
import fs from 'fs';
import yaml from 'js-yaml';
import { Config, Quotes } from '../types';

export class ConfigService {
  private readonly config: Config;

  constructor() {
    dotenv.config();

    const quotesPath = process.env.QUOTES_FILE || 'quotes.yaml';
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

const configService = new ConfigService();
export default configService;