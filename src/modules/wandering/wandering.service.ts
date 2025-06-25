// WanderingService refactored to use DatabaseService for persistence
import { TextChannel, Message, PermissionsBitField } from 'discord.js';
import { DatabaseService } from '../../services/database.service';
import { QuoteService } from '../../services/quote.service';
import { GuildService } from '../../services/guild.service';
import { ChannelDiscoveryService } from '../../services/channel-discovery.service';
import { ConfigService } from '../../services/config.service';

// Interfaces and constants
interface ChannelScore {
  channel: TextChannel;
  guildId: string;
  guildName: string;
  score: number;
  participantCount: number;
  minutesSinceLastMessage: number;
  botWasRecent: boolean;
  activityLevel: 'high' | 'medium' | 'low' | 'inactive';
  botMessagePercentage: number;
  humanActivityModifier: number;
  lonelinessBonus: number;
}

interface ChannelCache {
  eligibleChannels: TextChannel[];
  cachedAt: number;
}

interface GuildBatch {
  guilds: string[];
  batchIndex: number;
  totalBatches: number;
}

const DECISION_CYCLE_BASE_INTERVAL = (parseInt(process.env.DECISION_CYCLE_MINUTES || '45', 10)) * 60 * 1000;
const DECISION_CYCLE_JITTER_PERCENT = 20;
const STARTUP_DELAY = 2 * 60 * 1000;
const PER_GUILD_RATE_LIMIT_BASE = 6 * 60 * 60 * 1000;
const PER_GUILD_JITTER_PERCENT = 15;
const GLOBAL_RATE_LIMIT_BASE = 5 * 60 * 1000;
const GLOBAL_JITTER_PERCENT = 20;
const GUILD_BATCH_SIZE = 20;
const GUILD_BATCH_INTERVAL = 2 * 60 * 1000;
const CHANNEL_CACHE_DURATION = 60 * 60 * 1000;
const MAX_CHANNEL_INACTIVITY = 24 * 60 * 60 * 1000;
const MESSAGE_HISTORY_COUNT = 15;
const MAX_MESSAGES_PER_HOUR = 15;
const CIRCUIT_BREAKER_RESET_TIME = 60 * 60 * 1000;
const TIMESTAMP_CLEANUP_INTERVAL = 24 * 60 * 60 * 1000;
const TIMESTAMP_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export class WanderingService {
  private db: DatabaseService;
  private quoteService: QuoteService;
  private guildService: GuildService;
  private channelDiscoveryService: ChannelDiscoveryService;
  private configService: ConfigService;
  // Timer Management
  private decisionCycleInterval: NodeJS.Timeout | null = null;
  private cleanupIntervalId: NodeJS.Timeout | null = null;
  private hasStartupDelayPassed: boolean = false;
  // Rate Limiting & Safety
  private lastMessageTimestamps: Map<string, number> = new Map();
  private lastGlobalMessageTime: number = 0;
  private messagesThisHour: number = 0;
  private hourlyResetTime: number = 0;
  private circuitBreakerActive: boolean = false;
  private circuitBreakerActivatedAt: number = 0;
  // Performance & Batching
  private isProcessing: boolean = false;
  private channelCache: Map<string, ChannelCache> = new Map();
  private currentBatchIndex: number = 0;
  private guildBatches: GuildBatch[] = [];
  // Decision Making
  private potentialTargets: ChannelScore[] = [];
  private lastDecisionCycleTime: number = 0;

  constructor(
    db: DatabaseService,
    quoteService: QuoteService,
    guildService: GuildService,
    channelDiscoveryService: ChannelDiscoveryService,
    configService: ConfigService,
  ) {
    this.db = db;
    this.quoteService = quoteService;
    this.guildService = guildService;
    this.channelDiscoveryService = channelDiscoveryService;
    this.configService = configService;
    this.loadCooldowns();
  }

  /**
   * Load cooldown timestamps from persistent storage (now using SQLite)
   */
  private async loadCooldowns(): Promise<void> {
    try {
      const rows = await this.db.all('SELECT guildId, timestamp FROM wandering_cooldowns');
      const now = Date.now();
      let loadedCount = 0;
      let expiredCount = 0;
      for (const row of rows) {
        if (typeof row.timestamp === 'number' && row.timestamp > now) {
          this.lastMessageTimestamps.set(row.guildId, row.timestamp);
          loadedCount++;
        } else {
          expiredCount++;
        }
      }
      console.log(`WanderingService: Loaded ${loadedCount} active cooldowns from DB (${expiredCount} expired cooldowns discarded)`);
    } catch (error) {
      console.error('WanderingService: Error loading cooldowns from DB:', error);
      console.log('WanderingService: Continuing with empty cooldown state');
    }
  }

  /**
   * Save cooldown timestamps to persistent storage (now using SQLite)
   */
  private async saveCooldowns(): Promise<void> {
    try {
      await this.db.run('DELETE FROM wandering_cooldowns');
      for (const [guildId, timestamp] of this.lastMessageTimestamps.entries()) {
        await this.db.run('INSERT INTO wandering_cooldowns (guildId, timestamp) VALUES (?, ?)', [guildId, timestamp]);
      }
    } catch (error) {
      console.error('WanderingService: Error saving cooldowns to DB:', error);
    }
  }

  // Expose runDecisionCycle for integration tests and deterministic invocation
  public async runDecisionCycle(): Promise<void> {
    if (this.isProcessing) {
      console.log('WanderingService: Skipping decision cycle - already processing');
      return;
    }

    this.isProcessing = true;
    
    try {
      console.log('WanderingService: Starting decision cycle...');
      
      // Get all guilds
      const guilds = await this.guildService.getAllGuilds();
      if (!guilds || guilds.length === 0) {
        console.log('WanderingService: No guilds available');
        return;
      }

      console.log(`WanderingService: Evaluating ${guilds.length} guilds`);
      
      // Filter out guilds in observation period
      const eligibleGuilds = [];
      for (const guild of guilds) {
        const inObservation = await this.db.isGuildInObservationPeriod(guild.id);
        if (inObservation) {
          console.log(`WanderingService: Skipping ${guild.name} - still in 24h observation period`);
          continue;
        }
        eligibleGuilds.push(guild);
      }

      if (eligibleGuilds.length === 0) {
        console.log('WanderingService: No guilds eligible (all in observation period)');
        return;
      }

      console.log(`WanderingService: ${eligibleGuilds.length} guilds eligible for messaging`);

      // Process eligible guilds (basic implementation for now)
      for (const guild of eligibleGuilds) {
        try {
          await this.processGuildForMessage(guild);
        } catch (error) {
          console.error(`WanderingService: Error processing guild ${guild.name}:`, error);
        }
      }

    } catch (error) {
      console.error('WanderingService: Error in decision cycle:', error);
    } finally {
      this.isProcessing = false;
      this.lastDecisionCycleTime = Date.now();
    }
  }

  /**
   * Process a single guild for potential messaging
   */
  private async processGuildForMessage(guild: any): Promise<void> {
    const now = Date.now();
    const lastMessageTime = this.lastMessageTimestamps.get(guild.id) || 0;
    const timeSinceLastMessage = now - lastMessageTime;
    
    // Check if guild is still on cooldown (6 hours)
    if (timeSinceLastMessage < PER_GUILD_RATE_LIMIT_BASE) {
      const remainingMinutes = Math.ceil((PER_GUILD_RATE_LIMIT_BASE - timeSinceLastMessage) / (60 * 1000));
      console.log(`WanderingService: Guild ${guild.name} still on cooldown (${remainingMinutes} minutes remaining)`);
      return;
    }

    // Get eligible channels for this guild
    const allEligibleChannels = this.channelDiscoveryService.discoverEligibleChannels(guild);
    if (allEligibleChannels.length === 0) {
      console.log(`WanderingService: No eligible channels in ${guild.name}`);
      return;
    }

    // Filter out channels that are on cooldown (2 hours)
    const channelsOnCooldown = await this.db.getChannelsOnCooldown(guild.id);
    const availableChannels = allEligibleChannels.filter(channel => 
      !channelsOnCooldown.includes(channel.id)
    );

    if (availableChannels.length === 0) {
      console.log(`WanderingService: All channels in ${guild.name} are on cooldown`);
      return;
    }

    // Simple selection: pick a random available channel
    const selectedChannel = availableChannels[Math.floor(Math.random() * availableChannels.length)];
    console.log(`WanderingService: Selected #${selectedChannel.name} from ${availableChannels.length} available channels`);
    
    // Get a random quote
    const quote = this.quoteService.getWanderingMessage(selectedChannel.name);
    if (!quote || quote === '...') {
      console.log('WanderingService: No quotes available');
      return;
    }

    // Send the message
    try {
      const success = await this.guildService.sendMessageToChannel(selectedChannel.id, quote);
      if (success) {
        // Record both guild and channel timestamps for rate limiting
        this.lastMessageTimestamps.set(guild.id, now);
        await this.saveCooldowns();
        await this.db.recordChannelMessage(selectedChannel.id, guild.id);
        console.log(`WanderingService: Sent message to #${selectedChannel.name} in ${guild.name}`);
      }
    } catch (error) {
      console.error(`WanderingService: Failed to send message to ${guild.name}:`, error);
    }
  }
}
