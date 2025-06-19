import { TextChannel, Message, PermissionsBitField } from 'discord.js';
import { DiscordService } from './discord.service';
import { QuoteService } from './quote.service';
import { GuildService } from './guild.service';
import { ChannelDiscoveryService } from './channel-discovery.service';

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

// Decision Cycle Constants
const DECISION_CYCLE_BASE_INTERVAL = 10 * 60 * 1000; // 10 minutes base
const DECISION_CYCLE_JITTER_PERCENT = 20; // ±20% jitter (8-12 minutes)
const STARTUP_DELAY = 2 * 60 * 1000; // 2 minutes startup delay

// Rate Limiting Constants  
const PER_GUILD_RATE_LIMIT_BASE = 6 * 60 * 60 * 1000; // 6 hours base per guild
const PER_GUILD_JITTER_PERCENT = 15; // ±15% jitter (5.1-6.9 hours)
const GLOBAL_RATE_LIMIT_BASE = 5 * 60 * 1000; // 5 minutes base global
const GLOBAL_JITTER_PERCENT = 20; // ±20% jitter (4-6 minutes)

// Performance Constants
const GUILD_BATCH_SIZE = 20; // Process 20% of guilds per sub-cycle
const GUILD_BATCH_INTERVAL = 2 * 60 * 1000; // 2 minutes between batches
const CHANNEL_CACHE_DURATION = 60 * 60 * 1000; // 1 hour channel eligibility cache

// Scoring Constants
const MIN_SCORE_THRESHOLD = 50; // Minimum score to actually post
const MAX_CHANNEL_INACTIVITY = 24 * 60 * 60 * 1000; // 24 hours max inactivity
const MESSAGE_HISTORY_COUNT = 15; // Messages to analyze for scoring

// Safety Constants
const MAX_MESSAGES_PER_HOUR = 15; // Increased for multi-guild support
const CIRCUIT_BREAKER_RESET_TIME = 60 * 60 * 1000; // 1 hour circuit breaker reset
const TIMESTAMP_CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours - cleanup old timestamps
const TIMESTAMP_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days - max age for stored timestamps

export class WanderingService {
  private discordService: DiscordService;
  private quoteService: QuoteService;
  private guildService: GuildService;
  private channelDiscoveryService: ChannelDiscoveryService;
  
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
    discordService: DiscordService,
    quoteService: QuoteService,
    guildService: GuildService,
    channelDiscoveryService: ChannelDiscoveryService,
  ) {
    this.discordService = discordService;
    this.quoteService = quoteService;
    this.guildService = guildService;
    this.channelDiscoveryService = channelDiscoveryService;
  }

  public start(): void {
    if (this.decisionCycleInterval) {
      console.log('WanderingService is already running');
      return;
    }

    console.log('Starting WanderingService with intelligent decision cycle approach');
    console.log(`Decision cycles every ${DECISION_CYCLE_BASE_INTERVAL / 1000 / 60} minutes (±${DECISION_CYCLE_JITTER_PERCENT}% jitter)`);
    
    // Initial startup delay to allow full Discord connection
    setTimeout(() => {
      this.hasStartupDelayPassed = true;
      console.log('WanderingService: Startup delay complete, beginning decision cycles');
      this.startDecisionCycle();
    }, STARTUP_DELAY);
    
    // Start timestamp cleanup interval to prevent memory leaks
    this.cleanupIntervalId = setInterval(() => this.cleanupOldTimestamps(), TIMESTAMP_CLEANUP_INTERVAL);
  }

  private startDecisionCycle(): void {
    const jitteredInterval = this.getJitteredDelay(DECISION_CYCLE_BASE_INTERVAL, DECISION_CYCLE_JITTER_PERCENT);
    console.log(`Next decision cycle in ${Math.round(jitteredInterval / 1000 / 60 * 10) / 10} minutes`);
    
    this.decisionCycleInterval = setInterval(() => {
      this.runDecisionCycle();
      // Reschedule with new jitter
      if (this.decisionCycleInterval) {
        clearInterval(this.decisionCycleInterval);
        this.startDecisionCycle();
      }
    }, jitteredInterval);
  }

  public stop(): void {
    if (this.decisionCycleInterval) {
      console.log('Stopping WanderingService...');
      clearInterval(this.decisionCycleInterval);
      this.decisionCycleInterval = null;
    }
    
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
    
    this.hasStartupDelayPassed = false;
    this.isProcessing = false;
  }

  public emergencyStop(): void {
    console.error('🚨 EMERGENCY STOP ACTIVATED - Disabling all messaging');
    this.stop();
    this.circuitBreakerActive = true;
    this.circuitBreakerActivatedAt = Date.now();
  }

  public getStatus(): {
    isRunning: boolean;
    messagesThisHour: number;
    maxMessagesPerHour: number;
    circuitBreakerActive: boolean;
    lastGlobalMessageTime: number;
    isProcessing: boolean;
    hasStartupDelayPassed: boolean;
    potentialTargetsCount: number;
  } {
    return {
      isRunning: this.decisionCycleInterval !== null,
      messagesThisHour: this.messagesThisHour,
      maxMessagesPerHour: MAX_MESSAGES_PER_HOUR,
      circuitBreakerActive: this.circuitBreakerActive,
      lastGlobalMessageTime: this.lastGlobalMessageTime,
      isProcessing: this.isProcessing,
      hasStartupDelayPassed: this.hasStartupDelayPassed,
      potentialTargetsCount: this.potentialTargets.length,
    };
  }

  // Jitter Utilities
  private getJitteredDelay(baseMs: number, jitterPercent: number): number {
    const jitterRange = baseMs * (jitterPercent / 100);
    const jitter = (Math.random() * 2 - 1) * jitterRange; // -jitterRange to +jitterRange
    return Math.max(1000, baseMs + jitter); // Minimum 1 second
  }

  private getRandomBetween(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }

  // Phase 1: Decision Cycle & Candidate Discovery
  private async runDecisionCycle(): Promise<void> {
    if (this.isProcessing) {
      console.warn('WanderingService: Decision cycle already in progress, skipping');
      return;
    }

    if (!this.hasStartupDelayPassed) {
      console.log('WanderingService: Startup delay not complete, skipping decision cycle');
      return;
    }

    this.isProcessing = true;
    this.lastDecisionCycleTime = Date.now();
    
    try {
      console.log('🧠 WanderingService: Starting decision cycle');
      
      // Phase 1: Safety Gate Check
      if (!this.passesSafetyGates()) {
        console.log('WanderingService: Failed safety gates, cycle terminated');
        return;
      }

      // Phase 1: Candidate Discovery  
      this.potentialTargets = [];
      await this.discoverCandidatesAcrossAllGuilds();

      // Phase 2: Global Decision Making
      const winner = this.selectGlobalWinner();
      
      if (!winner) {
        console.log('WanderingService: No suitable candidates found, no action taken');
        return;
      }

      // Phase 3: Action and Cooldown
      await this.executeWanderingAction(winner);
      
    } catch (error) {
      console.error('WanderingService: Error in decision cycle:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private passesSafetyGates(): boolean {
    const now = Date.now();
    
    // Check circuit breaker
    if (this.circuitBreakerActive) {
      if (now - this.circuitBreakerActivatedAt > CIRCUIT_BREAKER_RESET_TIME) {
        console.log('WanderingService: Circuit breaker reset after cooldown');
        this.circuitBreakerActive = false;
        this.messagesThisHour = 0;
        this.hourlyResetTime = now + CIRCUIT_BREAKER_RESET_TIME;
      } else {
        console.log('WanderingService: Circuit breaker active');
        return false;
      }
    }

    // Reset hourly counter if needed
    if (now > this.hourlyResetTime) {
      this.messagesThisHour = 0;
      this.hourlyResetTime = now + CIRCUIT_BREAKER_RESET_TIME;
    }

    // Check emergency circuit breaker
    if (this.messagesThisHour >= MAX_MESSAGES_PER_HOUR) {
      console.error(`🚨 EMERGENCY CIRCUIT BREAKER ACTIVATED: ${this.messagesThisHour} messages sent in last hour`);
      this.circuitBreakerActive = true;
      this.circuitBreakerActivatedAt = now;
      return false;
    }

    // Global rate limiting with jitter
    const globalCooldown = this.getJitteredDelay(GLOBAL_RATE_LIMIT_BASE, GLOBAL_JITTER_PERCENT);
    if (now - this.lastGlobalMessageTime < globalCooldown) {
      console.log(`WanderingService: Global rate limit active (${Math.round((globalCooldown - (now - this.lastGlobalMessageTime)) / 1000)}s remaining)`);
      return false;
    }

    const client = this.discordService.getClient();
    if (!client.isReady()) {
      console.log('WanderingService: Discord client not ready');
      return false;
    }

    return true;
  }

  private async discoverCandidatesAcrossAllGuilds(): Promise<void> {
    const guilds = this.guildService.getAllGuilds();
    const now = Date.now();
    
    console.log(`🔍 WanderingService: Evaluating ${guilds.length} guilds for potential targets`);
    
    for (const guild of guilds) {
      try {
        // Check per-guild rate limiting with jitter
        const lastSent = this.lastMessageTimestamps.get(guild.id) || 0;
        const guildCooldown = this.getJitteredDelay(PER_GUILD_RATE_LIMIT_BASE, PER_GUILD_JITTER_PERCENT);
        
        if (now - lastSent < guildCooldown) {
          const remainingMinutes = Math.round((guildCooldown - (now - lastSent)) / 1000 / 60);
          console.log(`⏰ Guild ${guild.name}: On cooldown for ${remainingMinutes} more minutes`);
          continue;
        }

        // Find best channel in this guild
        const bestChannel = await this.findBestChannelInGuild(guild);
        if (bestChannel && bestChannel.score >= MIN_SCORE_THRESHOLD) {
          this.potentialTargets.push(bestChannel);
          console.log(`✅ Guild ${guild.name}: Found candidate channel ${bestChannel.channel.name} (score: ${bestChannel.score}, humans: ${bestChannel.participantCount}, bot%: ${bestChannel.botMessagePercentage})`);
        } else if (bestChannel) {
          console.log(`❌ Guild ${guild.name}: Best channel ${bestChannel.channel.name} score too low (${bestChannel.score} < ${MIN_SCORE_THRESHOLD}, bot%: ${bestChannel.botMessagePercentage})`);
        } else {
          console.log(`❌ Guild ${guild.name}: No eligible channels found`);
        }
        
        // Small delay between guilds to be nice to the API
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`Error evaluating guild ${guild.name}:`, error);
      }
    }
    
    console.log(`🎯 WanderingService: Found ${this.potentialTargets.length} potential targets`);
  }

  private async findBestChannelInGuild(guild: any): Promise<ChannelScore | null> {
    let eligibleChannels: TextChannel[];
    
    // Check cache first
    const cached = this.channelCache.get(guild.id);
    if (cached && Date.now() - cached.cachedAt < CHANNEL_CACHE_DURATION) {
      eligibleChannels = cached.eligibleChannels;
    } else {
      // Refresh cache
      eligibleChannels = this.channelDiscoveryService.discoverEligibleChannels(guild);
      this.channelCache.set(guild.id, {
        eligibleChannels,
        cachedAt: Date.now()
      });
    }

    if (eligibleChannels.length === 0) {
      return null;
    }

    let bestChannel: ChannelScore | null = null;
    
    for (const channel of eligibleChannels) {
      try {
        const score = await this.scoreChannel(channel, guild);
        if (score && (!bestChannel || score.score > bestChannel.score)) {
          bestChannel = score;
        }
      } catch (error) {
        console.warn(`Error scoring channel ${channel.name} in ${guild.name}:`, error);
      }
    }

    return bestChannel;
  }

  private async scoreChannel(channel: TextChannel, guild: any): Promise<ChannelScore | null> {
    try {
      // Pre-emptive permission check before attempting to fetch messages
      const permissions = channel.permissionsFor(channel.guild.members.me!);
      if (!permissions?.has(PermissionsBitField.Flags.ViewChannel) || !permissions?.has(PermissionsBitField.Flags.ReadMessageHistory)) {
        if (process.env.NODE_ENV !== 'test') {
          console.log(`⚠️  Skipping ${channel.name} in ${guild.name}: Missing permissions (ViewChannel: ${permissions?.has(PermissionsBitField.Flags.ViewChannel)}, ReadMessageHistory: ${permissions?.has(PermissionsBitField.Flags.ReadMessageHistory)})`);
        }
        return null;
      }

      // Fetch recent messages for analysis
      let messages;
      try {
        messages = await channel.messages.fetch({ limit: MESSAGE_HISTORY_COUNT });
      } catch (fetchError: unknown) {
        // Handle specific Discord API errors more gracefully
        if (process.env.NODE_ENV !== 'test') {
          if (fetchError instanceof Error && 'code' in fetchError) {
            const discordError = fetchError as Error & { code: number };
            if (discordError.code === 50001) {
              console.log(`⚠️  Missing Access to fetch messages in ${channel.name} (${guild.name}): Permission check passed but API call failed`);
            } else if (discordError.code === 50013) {
              console.log(`⚠️  Missing Permissions to fetch messages in ${channel.name} (${guild.name})`);
            } else {
              console.warn(`⚠️  Error fetching messages in ${channel.name} (${guild.name}):`, discordError.message);
            }
          } else {
            console.warn(`⚠️  Unknown error fetching messages in ${channel.name} (${guild.name}):`, fetchError);
          }
        }
        return null;
      }
      
      const messageArray = Array.from(messages.values()).reverse(); // Oldest first
      
      if (messageArray.length === 0) {
        return null; // Dead channel
      }

      const now = Date.now();
      const lastMessage = messageArray[messageArray.length - 1];
      const minutesSinceLastMessage = (now - lastMessage.createdTimestamp) / 1000 / 60;
      
      // Activity filter: Reject if too old
      if (minutesSinceLastMessage > (MAX_CHANNEL_INACTIVITY / 1000 / 60)) {
        return null;
      }

      // Enhanced participant analysis: Human vs Bot
      const humanAuthors = new Set<string>();
      const botAuthors = new Set<string>();
      let humanMessageCount = 0;
      let botMessageCount = 0;
      
      for (const message of messageArray) {
        if (message.author.bot) {
          botAuthors.add(message.author.id);
          botMessageCount++;
        } else {
          humanAuthors.add(message.author.id);
          humanMessageCount++;
        }
      }
      
      const totalMessages = messageArray.length;
      const botMessagePercentage = (botMessageCount / totalMessages) * 100;
      const participantCount = humanAuthors.size; // Only count human participants
      
      // Human activity modifier based on bot percentage
      let humanActivityModifier = 1.0;
      if (botMessagePercentage > 75) {
        humanActivityModifier = 0.1; // 90% penalty for bot-dominated channels
      } else if (botMessagePercentage > 50) {
        humanActivityModifier = 0.5; // 50% penalty for bot-heavy channels
      } else if (botMessagePercentage < 25) {
        humanActivityModifier = 1.2; // 20% bonus for human-centric channels
      }
      
      // Participant diversity score (now based only on human authors)
      let diversityScore = Math.min(100, participantCount * 10); // Max 100 points

      // Recency score (more recent = higher score)
      let recencyScore = Math.max(0, 100 - minutesSinceLastMessage); // Max 100 points
      
      // Bot presence penalty (our own bot)
      const botId = channel.client.user?.id;
      const recentMessages = messageArray.slice(-5); // Last 5 messages
      const botWasLastAuthor = lastMessage.author.id === botId;
      const botInRecentMessages = recentMessages.some(m => m.author.id === botId);

      if (botWasLastAuthor) {
        diversityScore *= 0.1; // 90% penalty
        recencyScore *= 0.1;
      } else if (botInRecentMessages) {
        diversityScore *= 0.5; // 50% penalty
        recencyScore *= 0.5;
      }

      // Calculate base score first, then apply human activity modifier to final result
      const baseScore = diversityScore + recencyScore;
      const totalScore = baseScore * humanActivityModifier;
      
      let activityLevel: 'high' | 'medium' | 'low' | 'inactive';
      // Activity level now considers human participants and bot percentage
      if (participantCount >= 5 && minutesSinceLastMessage < 30 && botMessagePercentage < 50) {
        activityLevel = 'high';
      } else if (participantCount >= 3 && minutesSinceLastMessage < 120 && botMessagePercentage < 75) {
        activityLevel = 'medium';
      } else if (minutesSinceLastMessage < 360 && botMessagePercentage < 90) {
        activityLevel = 'low';
      } else {
        activityLevel = 'inactive';
      }

      return {
        channel,
        guildId: guild.id,
        guildName: guild.name,
        score: Math.round(totalScore),
        participantCount,
        minutesSinceLastMessage: Math.round(minutesSinceLastMessage),
        botWasRecent: botInRecentMessages,
        activityLevel,
        botMessagePercentage: Math.round(botMessagePercentage),
        humanActivityModifier
      };
      
    } catch (error) {
      console.error(`Error scoring channel ${channel.name}:`, error);
      return null;
    }
  }

  // Phase 2: Global Decision Making
  private selectGlobalWinner(): ChannelScore | null {
    if (this.potentialTargets.length === 0) {
      return null;
    }

    // Sort by score descending
    this.potentialTargets.sort((a, b) => b.score - a.score);
    
    const winner = this.potentialTargets[0];
    
    console.log(`🏆 WanderingService: Selected ${winner.channel.name} in ${winner.guildName} (score: ${winner.score}, activity: ${winner.activityLevel})`);
    console.log(`📊 All candidates: ${this.potentialTargets.map(t => `${t.guildName}:${t.channel.name}(${t.score})`).join(', ')}`);
    
    return winner;
  }

  // Phase 3: Action and Cooldown
  private async executeWanderingAction(target: ChannelScore): Promise<void> {
    const message = this.quoteService.getWanderingMessage(target.channel.name);
    if (!message) {
      console.warn(`No message available for channel ${target.channel.name}`);
      return;
    }

    console.log(`💬 WanderingService: Sending to ${target.channel.name} in ${target.guildName}: "${message.substring(0, 50)}..."`);
    
    const success = await this.discordService.sendMessage(target.channel.id, message);
    
    if (success) {
      const now = Date.now();
      const jitteredGuildCooldown = this.getJitteredDelay(PER_GUILD_RATE_LIMIT_BASE, PER_GUILD_JITTER_PERCENT);
      
      this.lastMessageTimestamps.set(target.guildId, now);
      this.lastGlobalMessageTime = now;
      this.messagesThisHour++;
      
      console.log(`✅ WanderingService: Message sent successfully! Next visit to ${target.guildName} in ${Math.round(jitteredGuildCooldown / 1000 / 60 / 60 * 10) / 10} hours`);
      console.log(`📈 Messages this hour: ${this.messagesThisHour}/${MAX_MESSAGES_PER_HOUR}`);
    } else {
      console.error(`❌ Failed to send message to ${target.channel.name} in ${target.guildName}`);
    }
  }

  /**
   * Cleanup old timestamps to prevent memory leaks
   */
  private cleanupOldTimestamps(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    for (const [guildId, timestamp] of this.lastMessageTimestamps.entries()) {
      if (now - timestamp > TIMESTAMP_MAX_AGE) {
        expiredKeys.push(guildId);
      }
    }
    
    for (const key of expiredKeys) {
      this.lastMessageTimestamps.delete(key);
    }
    
    // Clean up channel cache too
    for (const [guildId, cache] of this.channelCache.entries()) {
      if (now - cache.cachedAt > CHANNEL_CACHE_DURATION * 2) { // 2x duration for cleanup
        this.channelCache.delete(guildId);
      }
    }
    
    if (expiredKeys.length > 0) {
      console.log(`WanderingService: Cleaned up ${expiredKeys.length} old timestamp entries`);
    }
  }

}
