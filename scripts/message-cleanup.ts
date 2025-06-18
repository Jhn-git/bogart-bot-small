// CLI script for safe Discord message cleanup

import container from '../src/container';
import { MessageCleanupOptions, MessageCleanupResult } from '../src/types';

async function main() {
  const cleanupMode = process.env.CLEANUP_MODE === 'true';
  const dryRun = process.argv.includes('--dry-run') || !cleanupMode;
  const confirm = process.argv.includes('--confirm') || cleanupMode;
  const hoursArg = process.argv.find((arg) => arg.startsWith('--hours='));
  const hours = hoursArg ? parseInt(hoursArg.split('=')[1], 10) : 48;

  await container.discordService.login();
  await container.messageCleanupService.init();

  if (dryRun) {
    console.log('Running in DRY-RUN mode. No messages will be deleted.');
  } else if (!confirm) {
    console.log('Confirmation required. Use --confirm or set CLEANUP_MODE=true to proceed.');
    process.exit(1);
  }

  const options: MessageCleanupOptions = {
    dryRun,
    confirm,
    hours,
    logProgress: true,
  };

  const result: MessageCleanupResult = await container.messageCleanupService.cleanupMessages(options);

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
}

main().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});