import { Client, GatewayIntentBits, TextChannel } from 'discord.js';
import { ConfigService } from './config.service';

export class DiscordService {
  private client: Client;
  private configService: ConfigService;
  private lastMessageTime: number = 0;
  private messagesSent: number = 0;
  private messageSendingDisabled: boolean = false;

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
    // Emergency disable check
    if (this.messageSendingDisabled) {
      console.warn('DiscordService: Message sending is disabled due to emergency stop');
      return false;
    }

    // Basic rate limiting at service level (additional safety layer)
    const now = Date.now();
    const minInterval = 30 * 1000; // 30 seconds minimum between messages at service level
    if (now - this.lastMessageTime < minInterval) {
      console.warn(`DiscordService: Rate limit active - ${minInterval/1000}s minimum between messages`);
      return false;
    }

    try {
      const channel = await this.client.channels.fetch(channelId);
      if (channel instanceof TextChannel) {
        await channel.send(message);
        this.lastMessageTime = now;
        this.messagesSent++;
        console.log(`DiscordService: Message sent successfully (total: ${this.messagesSent})`);
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

  public emergencyDisableMessaging(): void {
    console.error('🚨 DiscordService: Emergency disable activated - all message sending stopped');
    this.messageSendingDisabled = true;
  }

  public enableMessaging(): void {
    console.log('DiscordService: Message sending re-enabled');
    this.messageSendingDisabled = false;
  }

  public getMessageStats(): { sent: number; lastSent: number; disabled: boolean } {
    return {
      sent: this.messagesSent,
      lastSent: this.lastMessageTime,
      disabled: this.messageSendingDisabled,
    };
  }

  public getClient(): Client {
    return this.client;
  }
}
