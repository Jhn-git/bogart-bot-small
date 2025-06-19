import { Client, GatewayIntentBits, TextChannel } from 'discord.js';
import { ConfigService } from './config.service';
import { IStatusService } from '../types';

export class DiscordService {
  private client: Client;
  private configService: ConfigService;
  private lastMessageTime: number = 0;
  private messagesSent: number = 0;
  private messageSendingDisabled: boolean = false;
  private statusService: IStatusService | null = null;

  constructor(configService: ConfigService) {
    this.configService = configService;
    this.client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
    });

    this.client.on('ready', () => {
      console.log(`Logged in as ${this.client.user?.tag}!`);
      console.log(`Connected to ${this.client.guilds.cache.size} servers`);
      
      // Start status service when client is ready
      if (this.statusService && typeof this.statusService.start === 'function') {
        this.statusService.start();
      }
    });

    this.client.on('guildCreate', (guild) => {
      console.log(`Joined new server: ${guild.name} (${guild.id})`);
      console.log(`Now active in ${this.client.guilds.cache.size} servers`);
      
      // Notify status service of guild count change
      if (this.statusService && typeof this.statusService.onGuildCountChange === 'function') {
        this.statusService.onGuildCountChange();
      }
    });

    this.client.on('guildDelete', (guild) => {
      console.log(`Left server: ${guild.name} (${guild.id})`);
      console.log(`Now active in ${this.client.guilds.cache.size} servers`);
      
      // Notify status service of guild count change
      if (this.statusService && typeof this.statusService.onGuildCountChange === 'function') {
        this.statusService.onGuildCountChange();
      }
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

  public setStatusService(statusService: IStatusService): void {
    this.statusService = statusService;
  }
}
