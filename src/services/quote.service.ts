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
    console.log(`Getting wandering message for channel: ${channelName}`);
    console.log('Available quotes:', this.quotes);
    
    // First check channel-specific messages
    const channelSpecific = this.quotes.channel_specific_wandering_messages;
    if (channelSpecific && channelSpecific[channelName]?.length > 0) {
      console.log(`Found channel-specific message for ${channelName}`);
      return this.getRandomMessage(channelSpecific[channelName], placeholders);
    }

    // Then check goblin messages
    const goblinMessages = this.quotes.goblin_wandering_messages;
    if (goblinMessages && goblinMessages[channelName]?.length > 0) {
      console.log(`Found goblin message for ${channelName}`);
      return this.getRandomMessage(goblinMessages[channelName], placeholders);
    }

    // Finally use generic messages
    const genericMessages = this.quotes.generic_wandering_messages;
    if (genericMessages?.length > 0) {
      console.log('Using generic message');
      return this.getRandomMessage(genericMessages, placeholders);
    }

    console.warn('No messages available for any channel type');
    return '...';
  }

  private getRandomMessage(
    messages: string[],
    placeholders?: Record<string, string>
  ): string {
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
