import { StatusService } from '../status.service';
import { ActivityType } from 'discord.js';

describe('StatusService', () => {
  let statusService: StatusService;
  let mockDiscordService: any;
  let mockClient: any;
  let mockUser: any;

  beforeEach(() => {
    mockUser = {
      setActivity: jest.fn()
    };

    mockClient = {
      guilds: {
        cache: {
          size: 5
        }
      },
      user: mockUser
    };

    mockDiscordService = {
      getClient: jest.fn().mockReturnValue(mockClient)
    };

    statusService = new StatusService(mockDiscordService);
  });

  afterEach(() => {
    if (statusService) {
      statusService.stop();
    }
  });

  it('should initialize correctly', () => {
    expect(statusService).toBeDefined();
    
    const status = statusService.getStatus();
    expect(status.currentServerCount).toBe(5);
    expect(status.isActive).toBe(false);
    expect(status.generalMessageProbability).toBe(0.8);
    expect(status.serverCountMessageProbability).toBeCloseTo(0.2);
  });

  it('should set status when started', () => {
    statusService.start();

    // Should have called setActivity with either a general message or server count message
    expect(mockUser.setActivity).toHaveBeenCalledWith(
      expect.any(String),
      { type: expect.any(Number) }
    );

    const status = statusService.getStatus();
    expect(status.isActive).toBe(true);
  });

  it('should handle singular server count correctly', () => {
    mockClient.guilds.cache.size = 1;
    
    statusService.start();

    // Should have called setActivity with some status
    expect(mockUser.setActivity).toHaveBeenCalledWith(
      expect.any(String),
      { type: expect.any(Number) }
    );
  });

  it('should update status when guild count changes', () => {
    statusService.start();
    
    // Clear initial call
    mockUser.setActivity.mockClear();
    
    // Simulate guild count change
    mockClient.guilds.cache.size = 10;
    statusService.onGuildCountChange();

    // Should rotate to a new status
    expect(mockUser.setActivity).toHaveBeenCalledWith(
      expect.any(String),
      { type: expect.any(Number) }
    );
  });

  it('should stop rotation when stopped', () => {
    statusService.start();
    expect(statusService.getStatus().isActive).toBe(true);

    statusService.stop();
    expect(statusService.getStatus().isActive).toBe(false);
  });

  it('should handle missing client user gracefully', () => {
    mockClient.user = null;
    
    // Should not throw error
    expect(() => {
      statusService.start();
    }).not.toThrow();
  });
});