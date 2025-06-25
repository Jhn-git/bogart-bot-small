import {
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
    PermissionsBitField,
} from 'discord.js';
import { DatabaseService } from '../services/database.service';
import { GuildService } from '../services/guild.service';

export const data = new SlashCommandBuilder()
    .setName('hub')
    .setDescription('Access Bogart\'s Goblin Den - your friendly server companion!');

export async function execute(interaction: ChatInputCommandInteraction, databaseService: DatabaseService, guildService: GuildService) {
    // Defer the reply immediately to avoid timeout
    await interaction.deferReply({ ephemeral: true });
    
    const isAdmin = interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageChannels) || false;
    const guildId = interaction.guildId!;
    const guild = interaction.guild!;

    // Get guild metadata
    let guildMetadata = null;
    let serverStatus = "No data available";
    let lastActivity = "Unknown";
    let observationStatus = "";

    try {
        guildMetadata = await databaseService.getGuildMetadata(guildId);
        const inObservation = await databaseService.isGuildInObservationPeriod(guildId);
        
        if (inObservation) {
            const timeLeft = Math.ceil((guildMetadata?.observationEndTime - Date.now()) / (60 * 60 * 1000));
            observationStatus = `🔍 **Observation Mode** (${timeLeft}h remaining)`;
            serverStatus = "Learning about your server";
        } else {
            const engagementScore = guildMetadata?.engagementScore || 0.5;
            const scorePercent = Math.round(engagementScore * 100);
            serverStatus = `Active (${scorePercent}% positive reception)`;
            observationStatus = "✅ **Active Mode**";
        }

        // Get last activity info (simplified)
        const channelsOnCooldown = await databaseService.getChannelsOnCooldown(guildId);
        if (channelsOnCooldown.length > 0) {
            lastActivity = "Recent activity";
        } else {
            lastActivity = "Ready to chat";
        }
    } catch (error) {
        console.error('Hub: Error fetching guild data:', error);
    }

    const embed = new EmbedBuilder()
        .setColor(0x8B4513) // Brown goblin color
        .setTitle('🎭 Bogart\'s Goblin Den')
        .setDescription('*A quirky goblin friend who shares wisdom and fills quiet moments*')
        .addFields(
            // Server Status
            { 
                name: '🏰 Your Server Status', 
                value: `${observationStatus}\n📊 **Activity**: ${serverStatus}\n⏰ **Last Check**: ${lastActivity}`, 
                inline: false 
            },
            // What Bogart Does
            { 
                name: '🎯 What Bogart Does', 
                value: '• Shares goblin quotes and wisdom\n• Breaks uncomfortable silences\n• Adapts to your server\'s energy\n• Respects channel boundaries\n• Learns from your community', 
                inline: false 
            },
            // Current Settings
            { 
                name: '⚙️ Current Settings', 
                value: '• **Frequency**: Every 45 minutes\n• **Channel Cooldown**: 2 hours\n• **NSFW Channels**: Avoided\n• **Admin Channels**: Avoided', 
                inline: true 
            },
            // How It Works
            { 
                name: '🧠 How Bogart Learns', 
                value: '• Positive reactions → More active\n• No engagement → Less frequent\n• Admin deletions → Backs off\n• Natural conversation flow', 
                inline: true 
            }
        )
        .setFooter({ text: 'Bogart the Goblin • Friendly server companion' })
        .setTimestamp();

    const row1 = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('bogart_about')
                .setLabel('🎭 About Bogart')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('bogart_quotes')
                .setLabel('💬 Sample Quotes')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('bogart_activity')
                .setLabel('📊 Server Activity')
                .setStyle(ButtonStyle.Secondary)
        );

    const row2 = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('bogart_help')
                .setLabel('❓ How It Works')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('bogart_tips')
                .setLabel('💡 Integration Tips')
                .setStyle(ButtonStyle.Secondary)
        );

    // Add admin controls if user has permissions
    if (isAdmin) {
        row2.addComponents(
            new ButtonBuilder()
                .setCustomId('bogart_admin')
                .setLabel('🔧 Admin Config')
                .setStyle(ButtonStyle.Danger)
        );
    }

    try {
        await interaction.editReply({
            embeds: [embed],
            components: [row1, row2],
        });
    } catch (error) {
        console.error('Hub: Error displaying hub:', error);
        await interaction.editReply({ 
            content: 'An error occurred while opening Bogart\'s Den.' 
        });
    }
}