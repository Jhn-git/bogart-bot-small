import { ActivityType } from 'discord.js';
import { DiscordService } from './discord.service';

export class StatusService {
  private discordService: DiscordService;
  private rotationInterval: NodeJS.Timeout | null = null;
  private lastGoblinMessageIndex: number = -1;
  
  // Rotation settings - 80% general goblin messages, 20% server count
  private readonly ROTATION_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours rotation
  private readonly GENERAL_MESSAGE_PROBABILITY = 0.8; // 80% chance for general goblin messages
  private readonly STATUS_DURATION = 2 * 60 * 60 * 1000; // Status lasts until next rotation
  
  // General goblin messages with activity types (80% of the time)
  private readonly generalGoblinMessages = [
    { message: 'some of my favorite shows in my goblin cave', type: ActivityType.Watching },
    { message: 'to the sounds of the forest at night', type: ActivityType.Listening },
    { message: 'ancient goblin lullabies by the campfire', type: ActivityType.Listening },
    { message: 'my daily mushroom hunt in the woods', type: ActivityType.Streaming },
    { message: 'hide and seek with woodland creatures', type: ActivityType.Playing },
    { message: 'my treasure collection by moonlight', type: ActivityType.Watching },
    { message: 'to mysterious whispers in the wind', type: ActivityType.Listening },
    { message: 'the art of perfect rock polishing', type: ActivityType.Streaming },
    { message: 'a very serious game of acorn bowling', type: ActivityType.Playing },
    { message: 'the sunrise from my favorite tree branch', type: ActivityType.Watching },
    { message: 'to stories told by wise old owls', type: ActivityType.Listening },
    { message: 'my epic quest for the shiniest pebble', type: ActivityType.Streaming },
    { message: 'peek-a-boo with curious squirrels', type: ActivityType.Playing },
    { message: 'clouds shape-shift into cheese wheels', type: ActivityType.Watching },
    { message: 'to the symphony of rustling leaves', type: ActivityType.Listening },
    { message: 'my failed attempts at butterfly catching', type: ActivityType.Streaming },
    { message: 'tag with the neighborhood rabbits', type: ActivityType.Playing },
    { message: 'dewdrops race down flower petals', type: ActivityType.Watching }
  ] as const;

  // Server count messages with activity types (20% of the time)
  private readonly serverCountMessages = [
    { message: 'over {count} goblin kingdoms', type: ActivityType.Watching },
    { message: 'to whispers from {count} secret caves', type: ActivityType.Listening },
    { message: 'my treasure hunts across {count} realms', type: ActivityType.Streaming },
    { message: 'hide and seek in {count} magical forests', type: ActivityType.Playing },
    { message: 'the sunrise from {count} different mountains', type: ActivityType.Watching },
    { message: 'to ancient songs from {count} mystical lands', type: ActivityType.Listening },
    { message: 'my adventures through {count} enchanted places', type: ActivityType.Streaming },
    { message: 'pranks on friends in {count} goblin villages', type: ActivityType.Playing }
  ] as const;

  constructor(discordService: DiscordService) {
    this.discordService = discordService;
  }

  public start(): void {
    console.log('StatusService: Starting status management...');
    
    // Set initial status (use 80/20 logic)
    this.rotateStatus();
    
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
    // Immediately rotate to show new status when guild count changes
    this.rotateStatus();
  }

  private startRotationTimer(): void {
    this.rotationInterval = setInterval(() => {
      this.rotateStatus();
    }, this.ROTATION_INTERVAL_MS);
  }

  private rotateStatus(): void {
    // 80% chance for general goblin message, 20% chance for server count
    if (Math.random() < this.GENERAL_MESSAGE_PROBABILITY) {
      this.showGeneralGoblinMessage();
    } else {
      this.showServerCountMessage();
    }
  }

  private showGeneralGoblinMessage(): void {
    const messageData = this.getRandomGeneralMessage();
    console.log(`StatusService: Showing general goblin message: "${messageData.message}" (${ActivityType[messageData.type]})`);
    this.setStatus(messageData.message, messageData.type);
  }

  private showServerCountMessage(): void {
    const serverCount = this.getCurrentServerCount();
    const messageData = this.getRandomServerCountMessage(serverCount);
    console.log(`StatusService: Showing server count message: "${messageData.message}" (${ActivityType[messageData.type]})`);
    this.setStatus(messageData.message, messageData.type);
  }

  private getCurrentServerCount(): number {
    const client = this.discordService.getClient();
    return client.guilds.cache.size;
  }

  private getRandomGeneralMessage(): { message: string; type: ActivityType } {
    const messageIndex = Math.floor(Math.random() * this.generalGoblinMessages.length);
    return this.generalGoblinMessages[messageIndex];
  }

  private getRandomServerCountMessage(serverCount: number): { message: string; type: ActivityType } {
    // Avoid repeating the same message
    let messageIndex;
    do {
      messageIndex = Math.floor(Math.random() * this.serverCountMessages.length);
    } while (messageIndex === this.lastGoblinMessageIndex && this.serverCountMessages.length > 1);
    
    this.lastGoblinMessageIndex = messageIndex;
    
    const template = this.serverCountMessages[messageIndex];
    const message = template.message.replace('{count}', serverCount.toString());
    return { message, type: template.type };
  }

  private setStatus(message: string, type: ActivityType): void {
    try {
      const client = this.discordService.getClient();
      if (client.user) {
        client.user.setActivity(message, { type });
        console.log(`StatusService: Status set to "${ActivityType[type]} ${message}"`);
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
    generalMessageProbability: number;
    serverCountMessageProbability: number;
  } {
    return {
      isActive: this.rotationInterval !== null,
      currentServerCount: this.getCurrentServerCount(),
      generalMessageProbability: this.GENERAL_MESSAGE_PROBABILITY,
      serverCountMessageProbability: 1 - this.GENERAL_MESSAGE_PROBABILITY
    };
  }
}