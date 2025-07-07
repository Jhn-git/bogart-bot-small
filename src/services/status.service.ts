import { ActivityType } from 'discord.js';
import { DiscordService } from './discord.service';

export class StatusService {
  private discordService: DiscordService;
  private rotationInterval: NodeJS.Timeout | null = null;
  private isGoblinMessageActive: boolean = false;
  private lastGoblinMessageIndex: number = -1;
  
  // Rotation settings - reduced frequency to minimize noise
  private readonly ROTATION_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours (was 12 minutes)
  private readonly GOBLIN_MESSAGE_PROBABILITY = 0.15; // 15% chance (was 20%)
  private readonly GOBLIN_MESSAGE_DURATION = 20 * 60 * 1000; // 20 minutes (was 3 minutes)
  
  // Goblin message templates (will include server count)
  private readonly goblinMessages = [
    '🍄 Collecting mushrooms in {count} caves',
    '✨ Guarding treasures in {count} lairs',
    '🎭 Causing mischief across {count} realms',
    '📚 Reading goblin lore in {count} libraries',
    '🏠 Cozy in {count} goblin homes',
    '🔍 Exploring {count} mysterious places',
    '🎪 Entertaining goblins in {count} kingdoms',
    '🗝️ Finding secrets in {count} dungeons'
  ] as const;

  constructor(discordService: DiscordService) {
    this.discordService = discordService;
  }

  public start(): void {
    console.log('StatusService: Starting status management...');
    
    // Set initial status
    this.updateServerCountStatus();
    
    // Start rotation timer
    this.startRotationTimer();
  }

  public stop(): void {
    console.log('StatusService: Stopping status management...');
    
    if (this.rotationInterval) {
      clearInterval(this.rotationInterval);
      this.rotationInterval = null;
    }
  }

  public onGuildCountChange(): void {
    // Update status immediately when bot joins/leaves servers
    if (!this.isGoblinMessageActive) {
      this.updateServerCountStatus();
    }
  }

  private startRotationTimer(): void {
    this.rotationInterval = setInterval(() => {
      this.considerRotation();
    }, this.ROTATION_INTERVAL_MS);
  }

  private considerRotation(): void {
    // Don't rotate if already showing goblin message
    if (this.isGoblinMessageActive) {
      return;
    }

    // 20% chance to show goblin message
    if (Math.random() < this.GOBLIN_MESSAGE_PROBABILITY) {
      this.showGoblinMessage();
    }
  }

  private showGoblinMessage(): void {
    const serverCount = this.getCurrentServerCount();
    const goblinMessage = this.getRandomGoblinMessage(serverCount);
    
    console.log(`StatusService: Showing goblin message: "${goblinMessage}"`);
    
    this.setStatus(goblinMessage, ActivityType.Playing);
    this.isGoblinMessageActive = true;
    
    // Return to server count after duration
    setTimeout(() => {
      this.returnToServerCountStatus();
    }, this.GOBLIN_MESSAGE_DURATION);
  }

  private returnToServerCountStatus(): void {
    this.isGoblinMessageActive = false;
    this.updateServerCountStatus();
    // Reduced logging verbosity - only log when important
  }

  private updateServerCountStatus(): void {
    const serverCount = this.getCurrentServerCount();
    const statusMessage = `👥 Active in ${serverCount} server${serverCount !== 1 ? 's' : ''}`;
    
    this.setStatus(statusMessage, ActivityType.Watching);
  }

  private getCurrentServerCount(): number {
    const client = this.discordService.getClient();
    return client.guilds.cache.size;
  }

  private getRandomGoblinMessage(serverCount: number): string {
    // Avoid repeating the same message
    let messageIndex;
    do {
      messageIndex = Math.floor(Math.random() * this.goblinMessages.length);
    } while (messageIndex === this.lastGoblinMessageIndex && this.goblinMessages.length > 1);
    
    this.lastGoblinMessageIndex = messageIndex;
    
    const template = this.goblinMessages[messageIndex];
    return template.replace('{count}', serverCount.toString());
  }

  private setStatus(message: string, type: ActivityType): void {
    try {
      const client = this.discordService.getClient();
      if (client.user) {
        client.user.setActivity(message, { type });
        // Only log status changes when they're meaningful (goblin messages or errors)
        if (type === ActivityType.Playing) {
          console.log(`StatusService: Status set to "${message}"`);
        }
      } else {
        console.warn('StatusService: Client user not available for status update');
      }
    } catch (error) {
      console.error('StatusService: Error setting status:', error);
    }
  }

  public getStatus(): {
    isActive: boolean;
    currentServerCount: number;
    isShowingGoblinMessage: boolean;
    lastGoblinMessage: string | null;
  } {
    const serverCount = this.getCurrentServerCount();
    return {
      isActive: this.rotationInterval !== null,
      currentServerCount: serverCount,
      isShowingGoblinMessage: this.isGoblinMessageActive,
      lastGoblinMessage: this.lastGoblinMessageIndex >= 0 
        ? this.getRandomGoblinMessage(serverCount) 
        : null
    };
  }
}