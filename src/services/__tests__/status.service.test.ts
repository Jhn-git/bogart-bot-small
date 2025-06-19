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
    expect(status.isShowingGoblinMessage).toBe(false);
  });

  it('should set server count status when started', () => {
    statusService.start();

    expect(mockUser.setActivity).toHaveBeenCalledWith(
      '👥 Active in 5 servers',
      { type: ActivityType.Watching }
    );

    const status = statusService.getStatus();
    expect(status.isActive).toBe(true);
  });

  it('should handle singular server count correctly', () => {
    mockClient.guilds.cache.size = 1;
    
    statusService.start();

    expect(mockUser.setActivity).toHaveBeenCalledWith(
      '👥 Active in 1 server',
      { type: ActivityType.Watching }
    );
  });

  it('should update status when guild count changes', () => {
    statusService.start();
    
    // Clear initial call
    mockUser.setActivity.mockClear();
    
    // Simulate guild count change
    mockClient.guilds.cache.size = 10;
    statusService.onGuildCountChange();

    expect(mockUser.setActivity).toHaveBeenCalledWith(
      '👥 Active in 10 servers',
      { type: ActivityType.Watching }
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