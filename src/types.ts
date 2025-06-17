export interface Quotes {
  generic_wandering_messages: string[];
  goblin_wandering_messages: {
    [key: string]: string[];
  };
  [key: string]: any;
}

export interface Config {
  discordToken: string;
  guildId: string;
  quotes: Quotes;
}