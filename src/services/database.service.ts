// DatabaseService: Provides an abstraction over SQLite operations for the core platform.
import sqlite3 from 'sqlite3';
import path from 'path';

const DB_PATH = path.resolve(__dirname, '../../data/bogart.sqlite');

export class DatabaseService {
  private db: sqlite3.Database;

  constructor() {
    this.db = new sqlite3.Database(DB_PATH);
    this.initializeTables();
  }

  /**
   * Initialize database tables if they don't exist
   */
  private async initializeTables(): Promise<void> {
    try {
      await this.exec(`
        CREATE TABLE IF NOT EXISTS wandering_cooldowns (
          guildId TEXT PRIMARY KEY,
          timestamp INTEGER NOT NULL
        )
      `);

      await this.exec(`
        CREATE TABLE IF NOT EXISTS guild_metadata (
          guildId TEXT PRIMARY KEY,
          joinedAt INTEGER NOT NULL,
          observationEndTime INTEGER,
          engagementScore REAL DEFAULT 0.5,
          lastEngagementUpdate INTEGER
        )
      `);

      await this.exec(`
        CREATE TABLE IF NOT EXISTS channel_cooldowns (
          channelId TEXT PRIMARY KEY,
          guildId TEXT NOT NULL,
          lastMessageTime INTEGER NOT NULL
        )
      `);

      console.log('DatabaseService: Tables initialized successfully');
    } catch (error) {
      console.error('DatabaseService: Error initializing tables:', error);
    }
  }

  get(query: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      this.db.get(query, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  all(query: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  run(query: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(query, params, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  exec(query: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.exec(query, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Record when a guild was joined (for observation period tracking)
   */
  async recordGuildJoin(guildId: string): Promise<void> {
    const now = Date.now();
    const observationEndTime = now + (24 * 60 * 60 * 1000); // 24 hours from now
    
    await this.run(
      `INSERT OR REPLACE INTO guild_metadata 
       (guildId, joinedAt, observationEndTime, engagementScore, lastEngagementUpdate) 
       VALUES (?, ?, ?, 0.5, ?)`,
      [guildId, now, observationEndTime, now]
    );
  }

  /**
   * Check if a guild is still in its observation period
   */
  async isGuildInObservationPeriod(guildId: string): Promise<boolean> {
    const now = Date.now();
    const result = await this.get(
      'SELECT observationEndTime FROM guild_metadata WHERE guildId = ?',
      [guildId]
    );
    
    if (!result || !result.observationEndTime) {
      return false;
    }
    
    return result.observationEndTime > now;
  }

  /**
   * Get guild metadata including engagement score
   */
  async getGuildMetadata(guildId: string): Promise<any> {
    return await this.get(
      'SELECT * FROM guild_metadata WHERE guildId = ?',
      [guildId]
    );
  }

  /**
   * Record when a message was sent to a channel
   */
  async recordChannelMessage(channelId: string, guildId: string): Promise<void> {
    const now = Date.now();
    await this.run(
      'INSERT OR REPLACE INTO channel_cooldowns (channelId, guildId, lastMessageTime) VALUES (?, ?, ?)',
      [channelId, guildId, now]
    );
  }

  /**
   * Check if a channel is still on cooldown (2 hours)
   */
  async isChannelOnCooldown(channelId: string): Promise<boolean> {
    const now = Date.now();
    const twoHoursAgo = now - (2 * 60 * 60 * 1000); // 2 hours in milliseconds
    
    const result = await this.get(
      'SELECT lastMessageTime FROM channel_cooldowns WHERE channelId = ?',
      [channelId]
    );
    
    if (!result || !result.lastMessageTime) {
      return false;
    }
    
    return result.lastMessageTime > twoHoursAgo;
  }

  /**
   * Get all channels on cooldown for a guild
   */
  async getChannelsOnCooldown(guildId: string): Promise<string[]> {
    const now = Date.now();
    const twoHoursAgo = now - (2 * 60 * 60 * 1000);
    
    const results = await this.all(
      'SELECT channelId FROM channel_cooldowns WHERE guildId = ? AND lastMessageTime > ?',
      [guildId, twoHoursAgo]
    );
    
    return results.map(row => row.channelId);
  }
}
