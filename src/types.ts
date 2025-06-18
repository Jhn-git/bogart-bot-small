export interface Quotes {
  generic_wandering_messages: string[];
  goblin_wandering_messages: {
    [key: string]: string[];
  };
  [key: string]: any;
}

export interface Config {
  discordToken: string;
  quotes: Quotes;
}
export interface MessageCleanupOptions {
  dryRun?: boolean;
  confirm?: boolean;
  hours?: number; // How far back to look (default: 48)
  batchSize?: number; // Discord API max: 100, default: 50
  rateLimitMs?: number; // ms between deletions
  logProgress?: boolean;
}

export interface MessageCleanupLog {
  guildId: string;
  channelId: string;
  messageId: string | null;
  action: 'deleted' | 'dry-run' | 'skip' | 'error';
  reason: string;
}

export interface MessageCleanupResult {
  scanned: number;
  matched: number;
  deleted: MessageCleanupLog[];
  errors: MessageCleanupLog[];
  dryRun: boolean;
  confirm: boolean;
}