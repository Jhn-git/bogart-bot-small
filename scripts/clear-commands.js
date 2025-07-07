#!/usr/bin/env node

const { REST, Routes } = require('discord.js');
require('dotenv').config();

// Get Discord token from environment
const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID; // Add this to your .env if needed

if (!token) {
    console.error('❌ DISCORD_TOKEN not found in environment variables');
    process.exit(1);
}

if (!clientId) {
    console.error('❌ CLIENT_ID not found in environment variables');
    console.log('💡 Add CLIENT_ID=your_bot_application_id to your .env file');
    console.log('💡 You can find this in the Discord Developer Portal under your bot application');
    process.exit(1);
}

const rest = new REST().setToken(token);

async function clearCommands() {
    try {
        console.log('🧹 Starting to clear all slash commands...');
        
        // Clear global commands
        await rest.put(Routes.applicationCommands(clientId), { body: [] });
        console.log('✅ Successfully cleared all global slash commands!');
        
        // Optionally clear guild-specific commands if you use them
        // const guildId = 'your_guild_id_here';
        // await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
        // console.log('✅ Successfully cleared all guild-specific slash commands!');
        
    } catch (error) {
        console.error('❌ Error clearing commands:', error);
        process.exit(1);
    }
}

clearCommands();