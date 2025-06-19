import { EmbedBuilder, Guild, User, Colors } from 'discord.js';
import { DiscordService } from './discord.service';
import { ChannelDiscoveryService } from './channel-discovery.service';
import { ConfigService } from './config.service';

export class NotificationService {
  private discordService: DiscordService;
  private channelDiscoveryService: ChannelDiscoveryService;
  private configService: ConfigService;
  private notificationsSent: Set<string> = new Set();

  constructor(
    discordService: DiscordService,
    channelDiscoveryService: ChannelDiscoveryService,
    configService: ConfigService
  ) {
    this.discordService = discordService;
    this.channelDiscoveryService = channelDiscoveryService;
    this.configService = configService;
  }

  /**
   * Sends a rich embed notification to the bot owner when joining a new guild
   */
  public async notifyBotOwnerOnGuildJoin(guild: Guild): Promise<void> {
    const botOwnerId = this.configService.get('botOwnerId');
    if (!botOwnerId) {
      return;
    }

    try {
      const client = this.discordService.getClient();
      const totalGuilds = client.guilds.cache.size;

      const embed = new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle('🎉 Bot Joined New Server')
        .setDescription(`Successfully joined **${guild.name}**`)
        .addFields(
          { name: '📊 Server Name', value: guild.name, inline: true },
          { name: '👥 Member Count', value: guild.memberCount.toString(), inline: true },
          { name: '🏠 Total Servers', value: totalGuilds.toString(), inline: true },
          { name: '🆔 Server ID', value: guild.id, inline: false }
        )
        .setTimestamp()
        .setFooter({ text: 'Bogart Bot Monitoring' });

      await this.sendDMToUser(botOwnerId, { embeds: [embed] });
    } catch (error) {
      console.error('Failed to send guild join notification to bot owner:', error);
    }
  }

  /**
   * Sends a rich embed notification to the bot owner when leaving a guild
   */
  public async notifyBotOwnerOnGuildLeave(guild: Guild): Promise<void> {
    const botOwnerId = this.configService.get('botOwnerId');
    if (!botOwnerId) {
      return;
    }

    try {
      const client = this.discordService.getClient();
      const totalGuilds = client.guilds.cache.size;

      const embed = new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle('👋 Bot Left Server')
        .setDescription(`Left server **${guild.name}**`)
        .addFields(
          { name: '📊 Server Name', value: guild.name, inline: true },
          { name: '👥 Member Count', value: guild.memberCount?.toString() || 'Unknown', inline: true },
          { name: '🏠 Total Servers', value: totalGuilds.toString(), inline: true },
          { name: '🆔 Server ID', value: guild.id, inline: false }
        )
        .setTimestamp()
        .setFooter({ text: 'Bogart Bot Monitoring' });

      await this.sendDMToUser(botOwnerId, { embeds: [embed] });
    } catch (error) {
      console.error('Failed to send guild leave notification to bot owner:', error);
    }
  }

  /**
   * Checks guild permissions and notifies the server admin if there are issues
   */
  public async checkAndNotifyGuildOwnerOnJoin(guild: Guild): Promise<void> {
    const notificationKey = `guild-setup-${guild.id}`;
    
    // Don't spam the same guild owner multiple times
    if (this.notificationsSent.has(notificationKey)) {
      return;
    }

    try {
      // Check if we can find any eligible channels
      const eligibleChannels = this.channelDiscoveryService.discoverEligibleChannels(guild);
      
      if (eligibleChannels.length === 0) {
        await this.sendSetupNotificationToGuildAdmin(guild);
        this.notificationsSent.add(notificationKey);
      }
    } catch (error) {
      console.error(`Failed to check permissions for guild ${guild.name} (${guild.id}):`, error);
    }
  }

  /**
   * Sends a helpful setup message to the guild administrator
   */
  private async sendSetupNotificationToGuildAdmin(guild: Guild): Promise<void> {
    try {
      // Try to get the user who added the bot (if available) or fall back to guild owner
      let targetUser: User | null = null;
      
      // First try guild owner
      if (guild.ownerId) {
        try {
          targetUser = await this.discordService.getClient().users.fetch(guild.ownerId);
        } catch (error) {
          console.warn(`Could not fetch guild owner ${guild.ownerId}:`, error);
        }
      }

      if (!targetUser) {
        console.log(`No valid target user found for guild setup notification in ${guild.name}`);
        return;
      }

      const setupMessage = this.createSetupMessage(guild);
      await this.sendDMToUser(targetUser.id, { content: setupMessage });
      
      console.log(`Sent setup notification to guild admin for ${guild.name} (${guild.id})`);
    } catch (error) {
      console.error(`Failed to send setup notification for guild ${guild.name}:`, error);
    }
  }

  /**
   * Creates a user-friendly setup message for guild administrators
   */
  private createSetupMessage(guild: Guild): string {
    return `Hi! 👋

I just joined **${guild.name}**, but I'm having trouble finding channels where I can operate properly.

**To help me work correctly, please ensure I have these permissions:**
• **View Channels** - So I can see your text channels
• **Send Messages** - So I can share quotes and messages
• **Read Message History** - So I can understand channel context

**Quick Fix:**
1. Go to your Server Settings → Roles
2. Find the "Bogart" role (or my bot role)
3. Enable the permissions listed above
4. Or invite me to specific channels where you'd like me to be active

**What I do:**
I'm a friendly wandering bot that shares quotes and messages to keep your server lively. I'm designed to be respectful and only use channels that seem appropriate for casual conversation.

Thanks for adding me to your server! If you need help, feel free to reply to this message.

- Bogart Bot 🤖`;
  }

  /**
   * Sends a DM to a specific user with error handling
   */
  private async sendDMToUser(userId: string, messageOptions: { content?: string; embeds?: EmbedBuilder[] }): Promise<boolean> {
    try {
      const client = this.discordService.getClient();
      const user = await client.users.fetch(userId);
      
      await user.send(messageOptions);
      return true;
    } catch (error) {
      // Common reasons: user has DMs disabled, user blocked bot, user not found
      console.warn(`Failed to send DM to user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Clears the notification cache for a specific guild (useful for testing)
   */
  public clearGuildNotification(guildId: string): void {
    this.notificationsSent.delete(`guild-setup-${guildId}`);
  }

  /**
   * Gets notification statistics
   */
  public getStats(): { notificationsSent: number } {
    return {
      notificationsSent: this.notificationsSent.size
    };
  }
}