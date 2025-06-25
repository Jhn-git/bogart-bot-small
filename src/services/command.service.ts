import { 
    Client, 
    Collection, 
    SlashCommandBuilder, 
    ChatInputCommandInteraction, 
    ButtonInteraction,
    EmbedBuilder,
    MessageFlags,
    REST, 
    Routes 
} from 'discord.js';
import { ConfigService } from './config.service';
import { DatabaseService } from './database.service';
import { GuildService } from './guild.service';
import * as hubCommand from '../commands/hub';

interface Command {
    data: SlashCommandBuilder;
    execute: (interaction: ChatInputCommandInteraction, ...args: any[]) => Promise<void>;
}

export class CommandService {
    private client: Client;
    private configService: ConfigService;
    private databaseService: DatabaseService;
    private guildService: GuildService;
    private commands: Collection<string, Command> = new Collection();

    constructor(
        client: Client,
        configService: ConfigService,
        databaseService: DatabaseService,
        guildService: GuildService
    ) {
        this.client = client;
        this.configService = configService;
        this.databaseService = databaseService;
        this.guildService = guildService;
        
        this.loadCommands();
        this.setupInteractionHandler();
    }

    private loadCommands(): void {
        // Register hub command
        this.commands.set(hubCommand.data.name, hubCommand);
        console.log('CommandService: Loaded commands:', Array.from(this.commands.keys()));
    }

    private setupInteractionHandler(): void {
        this.client.on('interactionCreate', async (interaction) => {
            if (interaction.isChatInputCommand()) {
                const command = this.commands.get(interaction.commandName);
                if (!command) {
                    console.error(`No command matching ${interaction.commandName} was found.`);
                    return;
                }

                try {
                    await command.execute(interaction, this.databaseService, this.guildService);
                } catch (error) {
                    console.error('Error executing command:', error);
                    
                    // Only try to respond if the interaction hasn't expired
                    try {
                        const errorMessage = 'There was an error while executing this command!';
                        
                        if (interaction.replied || interaction.deferred) {
                            await interaction.followUp({ content: errorMessage, flags: MessageFlags.Ephemeral });
                        } else {
                            await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
                        }
                    } catch (replyError) {
                        console.error('Discord client error:', replyError);
                        // Interaction has expired, nothing we can do
                    }
                }
            } else if (interaction.isButton()) {
                try {
                    await this.handleButtonInteraction(interaction);
                } catch (error) {
                    console.error('Error handling button interaction:', error);
                    const errorMessage = 'There was an error processing your request!';
                    
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp({ content: errorMessage, flags: MessageFlags.Ephemeral });
                    } else {
                        await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
                    }
                }
            }
        });
    }

    private async handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
        const customId = interaction.customId;
        
        switch (customId) {
            case 'bogart_about':
                await this.handleAboutButton(interaction);
                break;
            case 'bogart_quotes':
                await this.handleQuotesButton(interaction);
                break;
            case 'bogart_activity':
                await this.handleActivityButton(interaction);
                break;
            case 'bogart_help':
                await this.handleHelpButton(interaction);
                break;
            case 'bogart_tips':
                await this.handleTipsButton(interaction);
                break;
            case 'bogart_admin':
                await this.handleAdminButton(interaction);
                break;
            default:
                await interaction.reply({
                    content: 'Unknown button interaction!',
                    flags: MessageFlags.Ephemeral
                });
        }
    }

    private async handleAboutButton(interaction: ButtonInteraction): Promise<void> {
        const embed = new EmbedBuilder()
            .setColor(0x8B4513)
            .setTitle('🎭 About Bogart the Goblin')
            .setDescription('*Meet your friendly server companion!*')
            .addFields(
                {
                    name: '🧙‍♂️ Who is Bogart?',
                    value: 'Bogart is a quirky goblin who\'s lived in many Discord servers. He\'s learned the art of conversation and knows when to speak up and when to listen.',
                    inline: false
                },
                {
                    name: '🎯 His Mission',
                    value: '• Fill awkward silences with wisdom\n• Share goblin insights at perfect moments\n• Learn each server\'s unique personality\n• Respect boundaries and channel rules',
                    inline: false
                },
                {
                    name: '🧠 How He\'s Smart',
                    value: '• Watches community reactions\n• Adapts to your server\'s energy\n• Avoids admin and sensitive channels\n• Gets less chatty if ignored',
                    inline: false
                }
            )
            .setFooter({ text: 'Bogart respects your community and learns from every interaction!' });

        await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral
        });
    }

    private async handleQuotesButton(interaction: ButtonInteraction): Promise<void> {
        const sampleQuotes = [
            "🍄 The best treasures are often found in the quietest caves...",
            "✨ A wise goblin once said: 'Hoarding snacks is the key to happiness.'",
            "🎭 Sometimes the most profound wisdom comes from the smallest creatures.",
            "🗝️ Every silence is just a conversation waiting to happen.",
            "📚 Knowledge is like cheese - it gets better when shared with friends."
        ];

        const embed = new EmbedBuilder()
            .setColor(0x8B4513)
            .setTitle('💬 Sample Goblin Wisdom')
            .setDescription('*Here are some examples of the quotes Bogart might share:*')
            .addFields(
                {
                    name: '🎯 Goblin Quotes',
                    value: sampleQuotes.join('\n\n'),
                    inline: false
                },
                {
                    name: '📝 Quote Selection',
                    value: 'Bogart chooses quotes based on:\n• Channel name and theme\n• Server activity level\n• Time since last message\n• Community engagement',
                    inline: false
                }
            )
            .setFooter({ text: 'Each quote is carefully chosen for the right moment!' });

        await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral
        });
    }

    private async handleActivityButton(interaction: ButtonInteraction): Promise<void> {
        const guildId = interaction.guildId!;
        
        try {
            const guildMetadata = await this.databaseService.getGuildMetadata(guildId);
            const channelsOnCooldown = await this.databaseService.getChannelsOnCooldown(guildId);
            const inObservation = await this.databaseService.isGuildInObservationPeriod(guildId);
            
            let statusText = "Active and ready";
            let engagementText = "No data yet";
            let cooldownText = "All channels available";
            
            if (inObservation) {
                const timeLeft = Math.ceil((guildMetadata?.observationEndTime - Date.now()) / (60 * 60 * 1000));
                statusText = `Observing (${timeLeft}h remaining)`;
            }
            
            if (guildMetadata?.engagementScore) {
                const score = Math.round(guildMetadata.engagementScore * 100);
                engagementText = `${score}% positive reception`;
            }
            
            if (channelsOnCooldown.length > 0) {
                cooldownText = `${channelsOnCooldown.length} channels on cooldown`;
            }

            const embed = new EmbedBuilder()
                .setColor(0x8B4513)
                .setTitle('📊 Server Activity Status')
                .addFields(
                    { name: '🏰 Current Status', value: statusText, inline: true },
                    { name: '💝 Community Reception', value: engagementText, inline: true },
                    { name: '⏰ Channel Availability', value: cooldownText, inline: true },
                    {
                        name: '📈 How Activity Works',
                        value: '• **Observation Mode**: Learning about your server (24h)\n• **Active Mode**: Regular participation based on reception\n• **Channel Cooldowns**: 2-hour break between messages per channel\n• **Guild Cooldowns**: 6-hour minimum between any messages',
                        inline: false
                    }
                )
                .setFooter({ text: 'Activity adapts based on your community\'s response!' });

            await interaction.reply({
                embeds: [embed],
                flags: MessageFlags.Ephemeral
            });
        } catch (error) {
            await interaction.reply({
                content: 'Could not fetch activity data. Please try again later.',
                flags: MessageFlags.Ephemeral
            });
        }
    }

    private async handleHelpButton(interaction: ButtonInteraction): Promise<void> {
        const embed = new EmbedBuilder()
            .setColor(0x8B4513)
            .setTitle('❓ How Bogart Works')
            .setDescription('*Understanding your goblin companion*')
            .addFields(
                {
                    name: '🕐 Timing System',
                    value: '• **Decision Cycles**: Every 45 minutes, Bogart considers sending a message\n• **Not Guaranteed**: He only speaks when conditions are right\n• **Respects Cooldowns**: Won\'t spam channels or servers',
                    inline: false
                },
                {
                    name: '🎯 Channel Selection',
                    value: '• **Avoided**: Admin, mod, rules, announcement, NSFW channels\n• **Preferred**: General chat, random, casual conversation channels\n• **Smart Selection**: Considers channel activity and naming patterns',
                    inline: false
                },
                {
                    name: '🧠 Learning System',
                    value: '• **Reactions**: ❤️ 😂 👍 = "They like me here!"\n• **Replies**: Direct responses = positive engagement\n• **Silence**: Consistent ignoring = less frequent messages\n• **Admin Deletions**: Strong signal to back off',
                    inline: false
                },
                {
                    name: '⚙️ Safety Features',
                    value: '• **New Server Grace**: 24-hour observation period\n• **Rate Limiting**: Maximum 1 message per 6 hours per server\n• **Channel Respect**: 2-hour cooldown per channel\n• **Permission Aware**: Only messages where allowed',
                    inline: false
                }
            )
            .setFooter({ text: 'Bogart learns and adapts to fit perfectly in your community!' });

        await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral
        });
    }

    private async handleTipsButton(interaction: ButtonInteraction): Promise<void> {
        const embed = new EmbedBuilder()
            .setColor(0x8B4513)
            .setTitle('💡 Integration Tips')
            .setDescription('*Making the most of your goblin friend*')
            .addFields(
                {
                    name: '✅ Encouraging Bogart',
                    value: '• **React positively** to messages you enjoy\n• **Reply or mention** Bogart when his timing is good\n• **Let conversations flow** naturally after his messages\n• **Be patient** - he\'s learning your server\'s personality',
                    inline: false
                },
                {
                    name: '🛑 If Bogart is Too Active',
                    value: '• **Ignore consistently** - he\'ll get the hint and reduce frequency\n• **Delete messages** - strong signal to back off\n• **Use admin controls** to adjust settings\n• **Contact support** for persistent issues',
                    inline: false
                },
                {
                    name: '🏗️ Server Setup Tips',
                    value: '• **Clear channel names** help Bogart understand purpose\n• **Proper permissions** ensure he only messages where welcome\n• **Introduce Bogart** to your community so they understand his role\n• **Set expectations** about his quirky goblin personality',
                    inline: false
                },
                {
                    name: '🎯 Best Practices',
                    value: '• **Give him time** to learn (first week is adjustment period)\n• **Treat him like a community member** rather than a bot\n• **Appreciate the organic timing** - not all silence needs filling\n• **Enjoy the personality** - he\'s meant to add character, not just utility',
                    inline: false
                }
            )
            .setFooter({ text: 'Remember: Bogart is designed to enhance, not dominate conversations!' });

        await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral
        });
    }

    private async handleAdminButton(interaction: ButtonInteraction): Promise<void> {
        // Check if user has admin permissions
        if (!interaction.memberPermissions?.has('ManageChannels')) {
            await interaction.reply({
                content: '🔒 You need "Manage Channels" permission to access admin controls.',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(0xFF6B35) // Orange for admin
            .setTitle('🔧 Admin Info')
            .setDescription('*Current Bogart settings and how to manage him*')
            .addFields(
                {
                    name: '⚙️ How Bogart Works',
                    value: '• **Frequency**: Checks every 45 minutes\n• **Channel Cooldown**: 2 hours between messages per channel\n• **New Server Learning**: 24 hours observation period\n• **Multi-guild**: Same settings across all servers',
                    inline: false
                },
                {
                    name: '🛠️ What You Can Do Right Now',
                    value: '• **Delete his messages** → He\'ll get the hint and be less active\n• **Channel permissions** → Remove his access to channels you don\'t want him in\n• **Reactions** → Positive reactions encourage him, negative ones discourage him',
                    inline: false
                },
                {
                    name: '📊 Why No Custom Settings?',
                    value: 'Bogart serves multiple Discord servers with shared settings. Per-server customization would require a complete rewrite. He\'s designed to adapt naturally through community feedback instead.',
                    inline: false
                }
            )
            .setFooter({ text: 'Bogart learns from your community\'s behavior - no config needed!' });

        await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral
        });
    }

    async registerCommands(): Promise<void> {
        const token = this.configService.get('discordToken');
        if (!token) {
            console.error('CommandService: No Discord token found, cannot register commands');
            return;
        }

        const rest = new REST().setToken(token);
        const clientId = this.client.user?.id;
        
        if (!clientId) {
            console.error('CommandService: Client not ready, cannot register commands');
            return;
        }

        try {
            const commandData = Array.from(this.commands.values()).map(command => command.data.toJSON());
            
            console.log(`CommandService: Started refreshing ${commandData.length} application (/) commands.`);

            // Register commands globally
            const data = await rest.put(
                Routes.applicationCommands(clientId),
                { body: commandData },
            ) as any[];

            console.log(`CommandService: Successfully reloaded ${data.length} application (/) commands.`);
        } catch (error) {
            console.error('CommandService: Error registering commands:', error);
        }
    }

    async clearAllCommands(): Promise<void> {
        const token = this.configService.get('discordToken');
        if (!token) {
            console.error('CommandService: No Discord token found, cannot clear commands');
            return;
        }

        const rest = new REST().setToken(token);
        const clientId = this.client.user?.id;
        
        if (!clientId) {
            console.error('CommandService: Client not ready, cannot clear commands');
            return;
        }

        try {
            console.log('CommandService: Clearing all application (/) commands.');
            
            // Clear all global commands by sending empty array
            const data = await rest.put(
                Routes.applicationCommands(clientId),
                { body: [] },
            ) as any[];

            console.log(`CommandService: Successfully cleared all application (/) commands.`);
        } catch (error) {
            console.error('CommandService: Error clearing commands:', error);
        }
    }
}