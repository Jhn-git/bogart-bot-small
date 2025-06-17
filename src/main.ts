import 'reflect-metadata';
import { discordService } from './services/discord.service';
import { wanderingService } from './services/wandering.service';

async function main() {
  await discordService.login();
  wanderingService.start();
}

main().catch((error) => {
  console.error('Unhandled error in main:', error);
  process.exit(1);
});