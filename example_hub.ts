import {
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
} from 'discord.js';
import logger from '../utils/logger';
import { UsageService, MONTHLY_CREDITS_BY_TIER } from '../services/usage/UsageService';
import { UserUsage, CreditTransaction } from '../database/repositories/UserUsageRepository';
import { links } from '../config';
import { dbService } from '../database'; // Import dbService for potential health check

export const data = new SlashCommandBuilder()
    .setName('hub')
    .setDescription('Access all Dr. Cardwell features from one place!');

export async function execute(interaction: ChatInputCommandInteraction) {
    logger.info(`[HUB] Hub command initiated by ${interaction.user.tag} in guild ${interaction.guildId}`);

    const usageService = new UsageService();
    let userUsage: UserUsage | null = null;
    let recentTransactions: CreditTransaction[] = [];
    let creditCosts = "Not available";
    let creditBalanceDisplay = "Credits: Not available";
    let tierDisplay = "Tier: Not available";
    let monthlyUsageDisplay = "Monthly Usage: Not available";
    let transactionHistoryDisplay = "No recent transactions.";

    try {
        userUsage = await usageService.getUserUsageDetails(interaction.user.id); // ensureUserExists is part of this
        if (userUsage) {
            creditBalanceDisplay = `💰 Credits: **${userUsage.credits_balance.toLocaleString()}**`;
            tierDisplay = `🌟 Tier: **${usageService.formatTierName(userUsage.patreon_tier)}**`;
            if (userUsage.patreon_tier !== 'free') {
                monthlyUsageDisplay = `📊 Monthly Usage: ${userUsage.credits_used_monthly?.toLocaleString() || 0} / ${MONTHLY_CREDITS_BY_TIER[userUsage.patreon_tier]?.toLocaleString() || 'N/A'}`;
            } else {
                monthlyUsageDisplay = `🎁 Starter Credits: ${userUsage.starter_credits_granted ? 'Granted' : 'Available'}`;
            }
        }

        recentTransactions = await usageService.getRecentTransactions(interaction.user.id, 3);
        if (recentTransactions.length > 0) {
            transactionHistoryDisplay = recentTransactions.map(t => {
                const date = new Date(t.created_at!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                return `\`${date}\` ${t.description} (\`${t.amount > 0 ? '+' : ''}${t.amount}\`)`;
            }).join('\n');
        }

        creditCosts = usageService.getFormattedCreditCosts();

    } catch (error) {
        logger.error('[HUB] Error fetching credit information:', error);
        // Fallback messages are already set
    }

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('Dr. Cardwell\'s Study Hub 🧠')
        .setDescription('Welcome! Manage your studies and credits below:')
        .addFields(
            // Credit Information First
            { name: 'Your Credit Status', value: `${creditBalanceDisplay}\n${tierDisplay}\n${monthlyUsageDisplay}`, inline: false },
            { name: 'Recent Activity', value: transactionHistoryDisplay, inline: false },
            { name: 'Credit Costs', value: `\`\`\`\n${creditCosts}\n\`\`\``, inline: false },
            // Main Features - AI Custom first to highlight it
            { name: '🤖 AI Custom Flashcards', value: 'Create personalized flashcards on ANY topic using AI! Just use `/flashcard topic:your_topic`', inline: false },
            { name: '📚 Browse Pre-made Topics', value: 'Explore 80+ ready-made flashcard subjects covering MCAT content.', inline: true },
            { name: '🃏 Quick Random Set', value: 'Get a random flashcard set from our pre-made collection.', inline: true },
            { name: '🔄 Redo Last Set', value: 'Revisit your most recent flashcard session.', inline: true },
            { name: '⚙️ Setup Bot', value: 'Configure Dr. Cardwell for this server (Admins).', inline: true },
            { name: '❓ Help & Guide', value: 'Get detailed help and usage instructions.', inline: true },
            { name: '📋 Changelog', value: 'See what\'s new with Dr. Cardwell.', inline: true },
            { name: '💚 Support Dr. Cardwell', value: `Join our [Discord](${links.supportServer}) for help and community support!`, inline: false }
        )
        .setFooter({ text: 'Dr. Cardwell' });

    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('hub_ai_custom')
                .setLabel('🤖 AI Custom Flashcards')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('hub_browse_topics')
                .setLabel('📚 Pre-made Topics')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('hub_quick_flashcards')
                .setLabel('🃏 Quick Random Set')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('hub_redo_last_set')
                .setLabel('🔄 Redo Last Set')
                .setStyle(ButtonStyle.Secondary)
        );

    const row2 = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('hub_setup_bot')
                .setLabel('⚙️ Setup Bot')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setLabel('💛 Premium')
                .setStyle(ButtonStyle.Link)
                .setURL(links.premium),
            new ButtonBuilder()
                .setLabel('💬 Support Discord')
                .setStyle(ButtonStyle.Link)
                .setURL(links.supportServer),
            new ButtonBuilder()
                .setCustomId('hub_changelog')
                .setLabel('📋 Changelog')
                .setStyle(ButtonStyle.Secondary)
        );

    try {
        await interaction.reply({
            embeds: [embed],
            components: [row, row2], // row2 now includes the support server button
            flags: MessageFlags.Ephemeral,
        });
        logger.info(`[HUB] Hub displayed to ${interaction.user.tag}`);
    } catch (error) {
        logger.error('[HUB] Error displaying hub:', error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'An error occurred while opening the hub.', flags: MessageFlags.Ephemeral });
        } else {
            await interaction.reply({ content: 'An error occurred while opening the hub.', flags: MessageFlags.Ephemeral });
        }
    }
}