import { QuoteService } from '../quote.service';
import { ConfigService } from '../config.service';
import { Quotes } from '../../types';

describe('QuoteService', () => {
  let configService: ConfigService;
  let quoteService: QuoteService;

  const mockQuotes: Quotes = {
    generic_wandering_messages: ['generic message'],
    goblin_wandering_messages: {
      'goblin-cave': ['goblin message'],
    },
  };

  beforeEach(() => {
    configService = new ConfigService();
    jest.spyOn(configService, 'get').mockReturnValue(mockQuotes);
    quoteService = new QuoteService(configService);
  });

  it('should return a message for a specific channel', () => {
    const message = quoteService.getWanderingMessage('goblin-cave');
    expect(message).toBe('goblin message');
  });

  it('should return a generic message if the channel is not found', () => {
    const message = quoteService.getWanderingMessage('unknown-channel');
    expect(message).toBe('generic message');
  });

  it('should return a random message from the list', () => {
    const messages = ['message 1', 'message 2', 'message 3'];
    const mockQuotes: Quotes = {
      generic_wandering_messages: messages,
      goblin_wandering_messages: {},
    };
    jest.spyOn(configService, 'get').mockReturnValue(mockQuotes);
    const quoteServiceNew = new QuoteService(configService);
    const message = quoteServiceNew.getWanderingMessage('any-channel');
    expect(messages).toContain(message);
  });

  it('should replace placeholders in the message', () => {
    const mockQuotes: Quotes = {
      generic_wandering_messages: ['hello {placeholder}'],
      goblin_wandering_messages: {},
    };
    jest.spyOn(configService, 'get').mockReturnValue(mockQuotes);
    const quoteServiceNew = new QuoteService(configService);
    const message = quoteServiceNew.getWanderingMessage('any-channel', {
      placeholder: 'world',
    });
    expect(message).toBe('hello world');
  });
});