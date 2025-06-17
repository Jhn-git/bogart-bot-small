import { QuoteService } from '../quote.service';
import { mockConfigService } from '../../__tests__/mocks';
import { Quotes } from '../../types';

jest.unmock('../quote.service');

describe('QuoteService', () => {
  let quoteService: QuoteService;

  const mockQuotes: Quotes = {
    generic_wandering_messages: ['generic message'],
    goblin_wandering_messages: {
      'goblin-cave': ['goblin message'],
    },
  };

  beforeEach(() => {
    (mockConfigService.get as jest.Mock).mockReturnValue(mockQuotes);
    quoteService = new QuoteService(mockConfigService);
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
    const mockLocalQuotes: Quotes = {
      generic_wandering_messages: messages,
      goblin_wandering_messages: {},
    };
    (mockConfigService.get as jest.Mock).mockReturnValue(mockLocalQuotes);
    const quoteServiceNew = new QuoteService(mockConfigService);
    const message = quoteServiceNew.getWanderingMessage('any-channel');
    expect(messages).toContain(message);
  });

  it('should replace placeholders in the message', () => {
    const mockLocalQuotes: Quotes = {
      generic_wandering_messages: ['hello {placeholder}'],
      goblin_wandering_messages: {},
    };
    (mockConfigService.get as jest.Mock).mockReturnValue(mockLocalQuotes);
    const quoteServiceNew = new QuoteService(mockConfigService);
    const message = quoteServiceNew.getWanderingMessage('any-channel', {
      placeholder: 'world',
    });
    expect(message).toBe('hello world');
  });
});