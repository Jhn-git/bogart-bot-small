import { Client, GatewayIntentBits, TextChannel } from 'discord.js';
import { ConfigService } from './config.service';

export class DiscordService {
  private client: Client;
  private configService: ConfigService;

  constructor(configService: ConfigService) {
    this.configService = configService;
    this.client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
    });

    this.client.on('ready', () => {
      console.log(`Logged in as ${this.client.user?.tag}!`);
    });

    this.client.on('error', (error) => {
      console.error('Discord client error:', error);
    });
  }

  public async login(): Promise<void> {
    try {
      await this.client.login(this.configService.get('discordToken'));
    } catch (error) {
      console.error('Failed to log in:', error);
      throw error;
    }
  }

  public async sendMessage(
    channelId: string,
    message: string,
  ): Promise<boolean> {
    try {
      const channel = await this.client.channels.fetch(channelId);
      if (channel instanceof TextChannel) {
        await channel.send(message);
        return true;
      } else {
        console.warn(`Channel ${channelId} is not a text channel.`);
        return false;
      }
    } catch (error) {
      console.error(`Failed to send message to channel ${channelId}:`, error);
      return false;
    }
  }

  public getClient(): Client {
    return this.client;
  }
}
