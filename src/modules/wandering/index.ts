import { WanderingService } from './wandering.service';

export function initialize(container: any) {
  // Register the WanderingService with the DI container
  container.register('wanderingService', (c: any) =>
    new WanderingService(
      c.resolve('databaseService'),
      c.resolve('quoteService'),
      c.resolve('guildService'),
      c.resolve('channelDiscoveryService'),
      c.resolve('configService')
    )
  );
  // Optionally, you can start the service here if needed:
  // c.resolve('wanderingService').start();
}
