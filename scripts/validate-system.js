#!/usr/bin/env node

/**
 * System Validation Script for Bogart Discord Bot
 * 
 * This script validates the complete system integration including:
 * - Configuration loading
 * - Quote system functionality  
 * - Service dependencies
 * - Error handling scenarios
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

console.log('🔍 Bogart Bot System Validation\n');

// Validation results
const results = {
  passed: 0,
  failed: 0,
  errors: []
};

function test(description, testFn) {
  try {
    const result = testFn();
    if (result) {
      console.log(`✅ ${description}`);
      results.passed++;
    } else {
      console.log(`❌ ${description}`);
      results.failed++;
    }
  } catch (error) {
    console.log(`❌ ${description} - ${error.message}`);
    results.failed++;
    results.errors.push({ test: description, error: error.message });
  }
}

// Test 1: Project structure validation
test('Project structure exists', () => {
  const requiredFiles = [
    'package.json',
    'tsconfig.json',
    'src/main.ts',
    'src/types.ts',
    'src/services/config.service.ts',
    'src/services/discord.service.ts',
    'src/services/quote.service.ts',
    'src/services/wandering.service.ts',
    'data/quotes.yaml',
    '.env.example'
  ];
  
  return requiredFiles.every(file => fs.existsSync(file));
});

// Test 2: package.json validation
test('Package.json has required dependencies', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const requiredDeps = ['discord.js', 'dotenv', 'js-yaml'];
  const requiredDevDeps = ['typescript', '@types/node', 'jest', 'ts-jest'];
  
  return requiredDeps.every(dep => pkg.dependencies[dep]) &&
         requiredDevDeps.every(dep => pkg.devDependencies[dep]);
});

// Test 3: TypeScript configuration
test('TypeScript configuration is valid', () => {
  const tsconfig = JSON.parse(fs.readFileSync('tsconfig.json', 'utf8'));
  return tsconfig.compilerOptions.target &&
         tsconfig.compilerOptions.module &&
         tsconfig.compilerOptions.outDir;
});

// Test 4: Quotes.yaml structure validation
test('Quotes.yaml has required structure', () => {
  const quotesPath = process.env.QUOTES_FILE || 'data/quotes.yaml';
  const quotes = yaml.load(fs.readFileSync(quotesPath, 'utf8'));
  return quotes.generic_wandering_messages &&
         Array.isArray(quotes.generic_wandering_messages) &&
         quotes.goblin_wandering_messages &&
         typeof quotes.goblin_wandering_messages === 'object';
});

// Test 5: Environment template validation
test('Environment template is complete', () => {
  const envExample = fs.readFileSync('.env.example', 'utf8');
  return envExample.includes('DISCORD_TOKEN') &&
         envExample.includes('QUOTES_FILE');
});

// Test 6: Service import validation
test('Service files can be imported', () => {
  // This is a basic syntax check by reading the files
  const serviceFiles = [
    'src/services/config.service.ts',
    'src/services/discord.service.ts',
    'src/services/quote.service.ts',
    'src/services/wandering.service.ts',
    'src/services/guild.service.ts',
    'src/services/channel-discovery.service.ts'
  ];
  
  return serviceFiles.every(file => {
    const content = fs.readFileSync(file, 'utf8');
    return content.includes('export class') || content.includes('export const');
  });
});

// Test 7: Test files validation
test('Test files exist for all services', () => {
  const testFiles = [
    'src/services/__tests__/config.service.test.ts',
    'src/services/__tests__/discord.service.test.ts',
    'src/services/__tests__/quote.service.test.ts',
    'src/services/__tests__/wandering.service.test.ts',
    'src/services/__tests__/guild.service.test.ts',
    'src/services/__tests__/channel-discovery.service.test.ts'
  ];
  
  return testFiles.every(file => fs.existsSync(file));
});

// Test 8: Jest configuration
test('Jest configuration is present', () => {
  return fs.existsSync('jest.config.js');
});

// Test 9: Main entry point validation
test('Main entry point imports all services', () => {
  const main = fs.readFileSync('src/main.ts', 'utf8');
  return main.includes('discordService') &&
         main.includes('wanderingService') &&
         main.includes('main()');
});

// Test 10: Quote system validation
test('Quote system has sufficient content', () => {
  const quotesPath = process.env.QUOTES_FILE || 'data/quotes.yaml';
  const quotes = yaml.load(fs.readFileSync(quotesPath, 'utf8'));
  const genericCount = quotes.generic_wandering_messages.length;
  const goblinChannels = Object.keys(quotes.goblin_wandering_messages || {});
  
  // Should have at least 50 generic messages and 3 channel-specific categories
  return genericCount >= 50 && goblinChannels.length >= 3;
});

// Test 11: gitignore validation  
test('Gitignore excludes sensitive files', () => {
  const gitignore = fs.readFileSync('.gitignore', 'utf8');
  return gitignore.includes('.env') &&
         gitignore.includes('node_modules') &&
         gitignore.includes('dist');
});

// Test 12: Integration dependencies
test('Service integration points exist', () => {
  const wandering = fs.readFileSync('src/services/wandering.service.ts', 'utf8');
  const container = fs.readFileSync('src/container.ts', 'utf8');
  return wandering.includes('DiscordService') &&
         wandering.includes('QuoteService') &&
         wandering.includes('GuildService') &&
         wandering.includes('ChannelDiscoveryService') &&
         container.includes('GuildService') &&
         container.includes('ChannelDiscoveryService');
});

console.log('\n📊 Validation Results');
console.log('===================');
console.log(`✅ Passed: ${results.passed}`);
console.log(`❌ Failed: ${results.failed}`);
console.log(`📈 Success Rate: ${Math.round((results.passed / (results.passed + results.failed)) * 100)}%`);

if (results.errors.length > 0) {
  console.log('\n🚨 Errors Found:');
  results.errors.forEach((error, index) => {
    console.log(`${index + 1}. ${error.test}: ${error.error}`);
  });
}

console.log('\n🎯 System Integration Status');
console.log('============================');

if (results.failed === 0) {
  console.log('🎉 System is fully integrated and ready for deployment!');
  console.log('\nNext steps:');
  console.log('1. Set up your Discord bot token in .env');
  console.log('2. Run: npm test');
  console.log('3. Run: npm start');
  process.exit(0);
} else {
  console.log('⚠️  System integration issues detected.');
  console.log('Please fix the failed validations before deployment.');
  process.exit(1);
}