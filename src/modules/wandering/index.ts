import { WanderingService } from './wandering.service';

export async function initialize(container: any) {
  console.log('WanderingModule: Initializing...');
  
  // Create and register the WanderingService
  const wanderingService = new WanderingService(
    container.databaseService,
    container.quoteService,
    container.guildService,
    container.channelDiscoveryService,
    container.configService
  );
  
  // Store it in the container for access
  container.wanderingService = wanderingService;
  
  // Start the service
  await wanderingService.start();
  
  console.log('WanderingModule: Initialized and started successfully');
}
