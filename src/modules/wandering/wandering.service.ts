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
   * Start the wandering service with regular decision cycles
   */
  public async start(): Promise<void> {
    console.log('WanderingService: Starting service...');
    
    // Initial startup delay
    setTimeout(async () => {
      this.hasStartupDelayPassed = true;
      console.log('WanderingService: Startup delay completed, service is now active');
      
      // Start the decision cycle
      await this.runDecisionCycle();
      
      // Set up regular decision cycles
      this.decisionCycleInterval = setInterval(async () => {
        try {
          await this.runDecisionCycle();
        } catch (error) {
          console.error('WanderingService: Error in scheduled decision cycle:', error);
        }
      }, DECISION_CYCLE_BASE_INTERVAL);
      
      console.log(`WanderingService: Decision cycle scheduled every ${DECISION_CYCLE_BASE_INTERVAL / 60000} minutes`);
    }, STARTUP_DELAY);
    
    // Set up cleanup interval
    this.cleanupIntervalId = setInterval(() => {
      this.cleanupExpiredTimestamps();
    }, TIMESTAMP_CLEANUP_INTERVAL);
  }

  /**
   * Stop the wandering service
   */
  public async stop(): Promise<void> {
    console.log('WanderingService: Stopping service...');
    
    if (this.decisionCycleInterval) {
      clearInterval(this.decisionCycleInterval);
      this.decisionCycleInterval = null;
    }
    
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
    
    // Save current cooldowns
    await this.saveCooldowns();
    
    console.log('WanderingService: Service stopped');
  }

  /**
   * Clean up expired timestamps
   */
  private cleanupExpiredTimestamps(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [guildId, timestamp] of this.lastMessageTimestamps.entries()) {
      if (now - timestamp > TIMESTAMP_MAX_AGE) {
        this.lastMessageTimestamps.delete(guildId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`WanderingService: Cleaned up ${cleanedCount} expired timestamps`);
    }
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
    
    console.log(`WanderingService: Evaluating guild '${guild.name}' (ID: ${guild.id})`);
    
    // Check if guild is still on cooldown (6 hours)
    if (timeSinceLastMessage < PER_GUILD_RATE_LIMIT_BASE) {
      const remainingMinutes = Math.ceil((PER_GUILD_RATE_LIMIT_BASE - timeSinceLastMessage) / (60 * 1000));
      console.log(`WanderingService: Guild ${guild.name} still on cooldown (${remainingMinutes} minutes remaining)`);
      return;
    }

    // Get eligible channels for this guild
    const allEligibleChannels = this.channelDiscoveryService.discoverEligibleChannels(guild);
    console.log(`WanderingService: Found ${allEligibleChannels.length} eligible channels in ${guild.name}`);
    
    if (allEligibleChannels.length === 0) {
      console.log(`WanderingService: No eligible channels in ${guild.name} - skipping`);
      return;
    }

    // Filter out channels that are on cooldown (2 hours)
    const channelsOnCooldown = await this.db.getChannelsOnCooldown(guild.id);
    const availableChannels = allEligibleChannels.filter(channel => 
      !channelsOnCooldown.includes(channel.id)
    );

    console.log(`WanderingService: ${channelsOnCooldown.length} channels on cooldown, ${availableChannels.length} available`);

    if (availableChannels.length === 0) {
      console.log(`WanderingService: All channels in ${guild.name} are on cooldown - skipping`);
      return;
    }

    // Calculate scores for available channels
    const channelScores = await this.calculateChannelScores(availableChannels, guild);
    
    // Sort channels by score (highest first)
    channelScores.sort((a, b) => b.score - a.score);
    
    // Log the top 3 channels for transparency
    console.log(`WanderingService: Channel scoring results for ${guild.name}:`);
    channelScores.slice(0, 3).forEach((channelScore, index) => {
      console.log(`  ${index + 1}. #${channelScore.channel.name}: ${channelScore.score.toFixed(1)} points (activity: ${channelScore.activityLevel}, loneliness: +${channelScore.lonelinessBonus.toFixed(1)})`);
    });

    // Select the highest scoring channel
    const selectedChannel = channelScores[0].channel;
    const selectedScore = channelScores[0];
    
    console.log(`WanderingService: Selected #${selectedChannel.name} (score: ${selectedScore.score.toFixed(1)}, last message: ${selectedScore.minutesSinceLastMessage}m ago)`);
    
    // Get a random quote
    const quote = this.quoteService.getWanderingMessage(selectedChannel.name);
    if (!quote || quote === '...') {
      console.log('WanderingService: No quotes available for selected channel');
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
        console.log(`WanderingService: Successfully sent message to #${selectedChannel.name} in ${guild.name}`);
      } else {
        console.warn(`WanderingService: Failed to send message to #${selectedChannel.name} in ${guild.name}`);
      }
    } catch (error) {
      console.error(`WanderingService: Error sending message to ${guild.name}:`, error);
    }
  }

  /**
   * Calculate scores for channels using the loneliness prevention algorithm
   */
  private async calculateChannelScores(channels: any[], guild: any): Promise<ChannelScore[]> {
    const scores: ChannelScore[] = [];
    
    for (const channel of channels) {
      try {
        const score = await this.calculateChannelScore(channel, guild);
        scores.push(score);
      } catch (error) {
        console.error(`WanderingService: Error calculating score for #${channel.name}:`, error);
      }
    }
    
    return scores;
  }

  /**
   * Calculate a single channel's score based on activity, diversity, and loneliness
   */
  private async calculateChannelScore(channel: any, guild: any): Promise<ChannelScore> {
    const now = Date.now();
    let score = 0;
    let participantCount = 0;
    let minutesSinceLastMessage = 0;
    let botWasRecent = false;
    let activityLevel: 'high' | 'medium' | 'low' | 'inactive' = 'inactive';
    let botMessagePercentage = 0;
    let humanActivityModifier = 1;
    let lonelinessBonus = 0;

    try {
      // Fetch recent messages
      const messages = await channel.messages.fetch({ limit: MESSAGE_HISTORY_COUNT });
      const recentMessages = messages.filter((msg: any) => now - msg.createdTimestamp < MAX_CHANNEL_INACTIVITY);
      
      if (recentMessages.size > 0) {
        const lastMessage = recentMessages.first();
        minutesSinceLastMessage = Math.floor((now - lastMessage.createdTimestamp) / (60 * 1000));
        
        // Count participants and bot messages
        const participants = new Set<string>();
        let botMessages = 0;
        
        recentMessages.forEach((msg: any) => {
          participants.add(msg.author.id);
          if (msg.author.bot) {
            botMessages++;
          }
        });
        
        participantCount = participants.size;
        botMessagePercentage = (botMessages / recentMessages.size) * 100;
        botWasRecent = recentMessages.some((msg: any) => 
          msg.author.id === guild.members.me?.id && 
          now - msg.createdTimestamp < 2 * 60 * 60 * 1000 // 2 hours
        );
        
        // Determine activity level
        if (recentMessages.size >= 10) activityLevel = 'high';
        else if (recentMessages.size >= 5) activityLevel = 'medium';
        else if (recentMessages.size >= 1) activityLevel = 'low';
        
        // Base activity score
        score += recentMessages.size * 2;
        
        // Diversity bonus (more participants = better)
        score += participantCount * 5;
        
        // Human activity modifier (prefer channels with more human activity)
        if (botMessagePercentage < 50) {
          humanActivityModifier = 1.5;
        } else if (botMessagePercentage < 75) {
          humanActivityModifier = 1.2;
        } else {
          humanActivityModifier = 0.8;
        }
        
        // Loneliness bonus (prefer channels that haven't been active recently)
        if (minutesSinceLastMessage > 360) { // 6 hours
          lonelinessBonus = 30;
        } else if (minutesSinceLastMessage > 180) { // 3 hours
          lonelinessBonus = 15;
        } else if (minutesSinceLastMessage > 60) { // 1 hour
          lonelinessBonus = 5;
        }
        
        // Avoid recently bot-active channels
        if (botWasRecent) {
          score *= 0.5;
        }
        
      } else {
        // Very inactive channel - still gets some loneliness bonus
        minutesSinceLastMessage = 1440; // 24 hours placeholder
        lonelinessBonus = 20;
      }
      
      // Apply modifiers
      score *= humanActivityModifier;
      score += lonelinessBonus;
      
      // Ensure minimum score
      score = Math.max(score, 1);
      
    } catch (error) {
      console.error(`WanderingService: Error analyzing channel #${channel.name}:`, error);
      score = 1; // Fallback score
    }

    return {
      channel,
      guildId: guild.id,
      guildName: guild.name,
      score,
      participantCount,
      minutesSinceLastMessage,
      botWasRecent,
      activityLevel,
      botMessagePercentage,
      humanActivityModifier,
      lonelinessBonus
    };
  }
}
