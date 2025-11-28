import {
    ApplicationCommandOptionType,
    CommandInteraction,
    EmbedBuilder,
    Colors,
    MessageFlags,
} from "discord.js"
import { Discord, Slash, SlashGroup, SlashOption } from "discordx"
import { QueueManager } from "@managers/QueueManager"
import {
    QueueNotFoundError,
    SessionAlreadyActiveError,
    QueueError,
} from "../../errors/QueueErrors"

@Discord()
@SlashGroup({ name: "tutor", description: "Tutor commands" })
@SlashGroup({ name: "session", description: "Session management", root: "tutor" })
export class TutorSession {
    private queueManager = new QueueManager()

    @Slash({ name: "create", description: "Start a tutoring session" })
    @SlashGroup("session", "tutor")
    async create(
        @SlashOption({
            name: "queue",
            description: "The name of the queue (optional)",
            required: false,
            type: ApplicationCommandOptionType.String,
        })
        name: string | undefined,
        interaction: CommandInteraction
    ): Promise<void> {
        if (!interaction.guild) {
            await interaction.reply({
                content: "This command can only be used in a server.",
                flags: MessageFlags.Ephemeral,
            })
            return
        }

        try {
            const queue = await this.queueManager.resolveQueue(interaction.guild.id, name)
            await this.queueManager.createSession(interaction.guild.id, queue.name, interaction.user.id)

            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Session Started")
                        .setDescription(`You have started a session on queue **${queue.name}**.`)
                        .setColor(Colors.Green),
                ],
                flags: MessageFlags.Ephemeral,
            })
        } catch (error: any) {
            let errorMessage = "Failed to start session."
            if (error instanceof QueueNotFoundError) {
                errorMessage = `Queue **${name}** not found.`
            } else if (error instanceof SessionAlreadyActiveError) {
                errorMessage = "You already have an active session."
            } else if (error instanceof QueueError) {
                errorMessage = error.message
            }

            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Error")
                        .setDescription(errorMessage)
                        .setColor(Colors.Red),
                ],
                flags: MessageFlags.Ephemeral,
            })
        }
    }

    @Slash({ name: "end", description: "End your tutoring session" })
    @SlashGroup("session", "tutor")
    async end(
        @SlashOption({
            name: "queue",
            description: "The name of the queue (optional)",
            required: false,
            type: ApplicationCommandOptionType.String,
        })
        name: string | undefined,
        interaction: CommandInteraction
    ): Promise<void> {
        if (!interaction.guild) {
            await interaction.reply({
                content: "This command can only be used in a server.",
                flags: MessageFlags.Ephemeral,
            })
            return
        }

        try {
            const queue = await this.queueManager.resolveQueue(interaction.guild.id, name)
            await this.queueManager.endSession(interaction.guild.id, queue.name, interaction.user.id)

            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Session Ended")
                        .setDescription(`You have ended your session on queue **${queue.name}**.`)
                        .setColor(Colors.Yellow),
                ],
                flags: MessageFlags.Ephemeral,
            })
        } catch (error: any) {
            let errorMessage = "Failed to end session."
            if (error instanceof QueueNotFoundError) {
                errorMessage = `Queue **${name}** not found.`
            } else if (error instanceof QueueError) {
                errorMessage = error.message
            }

            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Error")
                        .setDescription(errorMessage)
                        .setColor(Colors.Red),
                ],
                flags: MessageFlags.Ephemeral,
            })
        }
    }
}
