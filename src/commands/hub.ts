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
    try {
        // Defer the reply immediately to avoid timeout - this must be first
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    } catch (error) {
        console.error('Hub: Failed to defer reply - interaction may have expired:', error);
        return;
    }
    
    const isAdmin = interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageChannels) || false;
    const guildId = interaction.guildId!;
    const guild = interaction.guild!;

    // Get simple guild status
    let botStatus = "🤖 Active";
    let isLearning = false;

    try {
        const guildMetadata = await databaseService.getGuildMetadata(guildId);
        const inObservation = await databaseService.isGuildInObservationPeriod(guildId);
        
        if (inObservation) {
            botStatus = "🎓 Learning your server";
            isLearning = true;
        }
    } catch (error) {
        console.error('Hub: Error fetching guild data:', error);
    }

    const embed = new EmbedBuilder()
        .setColor(0x8B4513) // Brown goblin color
        .setTitle('🎭 Meet Bogart!')
        .setDescription(
            `*A friendly goblin who shares wisdom and breaks awkward silences*\n\n` +
            `**Status**: ${botStatus}\n` +
            (isLearning ? 
                `🎓 Bogart is getting to know your server and will start chatting soon!` :
                `💬 Bogart occasionally shares quotes when things get quiet`)
        )
        .addFields(
            { 
                name: '🤔 What does Bogart do?', 
                value: '• Shares interesting quotes and thoughts\n• Only speaks when channels are quiet\n• Gets less chatty if people aren\'t interested\n• Avoids NSFW and admin channels', 
                inline: false 
            }
        )
        .setFooter({ text: 'Bogart won\'t spam - he\'s quite polite for a goblin!' });

    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('bogart_quotes')
                .setLabel('📖 Sample Quotes')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('bogart_help')
                .setLabel('❓ Quick Help')
                .setStyle(ButtonStyle.Secondary)
        );

    // Add admin controls if user has permissions
    if (isAdmin) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId('bogart_admin')
                .setLabel('🔧 Admin Info')
                .setStyle(ButtonStyle.Secondary)
        );
    }

    try {
        await interaction.editReply({
            embeds: [embed],
            components: [row],
        });
    } catch (error) {
        console.error('Hub: Error displaying hub:', error);
        await interaction.editReply({ 
            content: 'An error occurred while opening Bogart\'s Den.' 
        });
    }
}