import { ConfigService } from './config.service';
import { Quotes } from '../types';

export class QuoteService {
  private quotes: Quotes;

  constructor(configService: ConfigService) {
    this.quotes = configService.get('quotes');
  }

  public getWanderingMessage(
    channelName: string,
    placeholders?: Record<string, string>,
  ): string {
    const goblinMessages = this.quotes.goblin_wandering_messages;
    const genericMessages = this.quotes.generic_wandering_messages;

    let messages: string[] | undefined;

    if (
      goblinMessages &&
      typeof goblinMessages === 'object' &&
      channelName in goblinMessages
    ) {
      messages = goblinMessages[channelName];
    }

    if (!messages || messages.length === 0) {
      messages = genericMessages;
    }

    if (!messages || messages.length === 0) {
      return '...';
    }

    const randomIndex = Math.floor(Math.random() * messages.length);
    let message = messages[randomIndex];

    if (placeholders) {
      for (const key in placeholders) {
        message = message.replace(`{${key}}`, placeholders[key]);
      }
    }

    return message;
  }
}
