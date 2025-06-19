import 'reflect-metadata';
import container from './container';

let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) {
    console.log(`${signal} received again, forcefully exiting...`);
    process.exit(1);
  }

  isShuttingDown = true;
  console.log(`${signal} received, starting graceful shutdown...`);

  try {
    // Stop the wandering service first
    console.log('Stopping wandering service...');
    container.wanderingService.stop();

    // Destroy the Discord client
    console.log('Disconnecting from Discord...');
    const client = container.discordService.getClient();
    if (client) {
      await client.destroy();
    }

    console.log('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
}

async function main() {
  console.log('Starting Bogart Discord Bot...');

  // Set up signal handlers for graceful shutdown
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection');
  });

  try {
    await container.discordService.login();
    container.wanderingService.start();
    console.log('Bogart Discord Bot started successfully!');
  } catch (error) {
    console.error('Failed to start bot:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled error in main:', error);
  process.exit(1);
});