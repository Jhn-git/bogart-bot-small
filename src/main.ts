import 'reflect-metadata';
import container from './container';
import fs from 'fs';
import path from 'path';

async function loadModules(container: any) {
  const modulesDir = path.join(__dirname, 'modules');
  if (!fs.existsSync(modulesDir)) return;
  const moduleNames = fs.readdirSync(modulesDir).filter((name) => {
    const modPath = path.join(modulesDir, name);
    return fs.statSync(modPath).isDirectory();
  });
  for (const modName of moduleNames) {
    const modIndex = path.join(modulesDir, modName, 'index.js');
    if (fs.existsSync(modIndex)) {
      const mod = await import(`./modules/${modName}/index.js`);
      if (mod && typeof mod.initialize === 'function') {
        await mod.initialize(container);
      }
    }
  }
}

let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) {
    console.log(`${signal} received again, forcefully exiting...`);
    process.exit(1);
  }
  isShuttingDown = true;
  console.log(`${signal} received, starting graceful shutdown...`);
  try {
    // Dynamically stop all services that have a stop method
    for (const key of Object.keys(container)) {
      const service = (container as any)[key];
      if (service && typeof service.stop === 'function') {
        try { await service.stop(); } catch {}
      }
    }
    // Destroy the Discord client
    if (container.discordService) {
      const client = container.discordService.getClient();
      if (client) {
        await client.destroy();
      }
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
  if (process.env.CLEANUP_MODE === 'true') {
    console.warn('⚠️  WARNING: CLEANUP_MODE is deprecated and no longer supported in bot startup.');
    console.warn('   To run message cleanup, use: npm run cleanup -- --confirm');
    console.warn('   Remove CLEANUP_MODE from your .env file to eliminate this warning.');
  }
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
  });
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection');
  });
  try {
    await container.discordService.login();
    await loadModules(container);
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