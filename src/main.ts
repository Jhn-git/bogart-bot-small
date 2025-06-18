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

    if (process.env.CLEANUP_MODE === 'true') {
      console.log('CLEANUP_MODE enabled. Running message cleanup...');
      await container.messageCleanupService.init();
      const dryRun = process.argv.includes('--dry-run') || !process.argv.includes('--confirm');
      const confirm = process.argv.includes('--confirm');
      const hoursArg = process.argv.find((arg) => arg.startsWith('--hours='));
      const hours = hoursArg ? parseInt(hoursArg.split('=')[1], 10) : 48;

      const result = await container.messageCleanupService.cleanupMessages({
        dryRun,
        confirm,
        hours,
        logProgress: true,
      });

      console.log('\nCleanup Summary:');
      console.log(`Scanned: ${result.scanned}`);
      console.log(`Matched: ${result.matched}`);
      console.log(`Deleted: ${result.deleted.length}`);
      console.log(`Errors: ${result.errors.length}`);

      if (result.deleted.length > 0) {
        console.log('\nDeleted/Dry-run Messages:');
        result.deleted.forEach((log) => {
          console.log(`[${log.action}] Guild: ${log.guildId}, Channel: ${log.channelId}, Message: ${log.messageId}, Reason: ${log.reason}`);
        });
      }

      if (result.errors.length > 0) {
        console.log('\nErrors:');
        result.errors.forEach((log) => {
          console.error(`[${log.action}] Guild: ${log.guildId}, Channel: ${log.channelId}, Message: ${log.messageId}, Reason: ${log.reason}`);
        });
      }

      process.exit(0);
    }

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