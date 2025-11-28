import {
    ApplicationCommandOptionType,
    CommandInteraction,
    EmbedBuilder,
    Colors,
    MessageFlags,
} from "discord.js"
import { Discord, Slash, SlashGroup, SlashOption } from "discordx"
import { QueueManager } from "@managers/QueueManager"

@Discord()
@SlashGroup("queue")
export class QueueLeave {
    private queueManager = new QueueManager()

    @Slash({ name: "leave", description: "Leave a queue" })
    async leave(
        @SlashOption({
            name: "name",
            description: "The name of the queue to leave",
            required: true,
            type: ApplicationCommandOptionType.String,
        })
        name: string,
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
            await this.queueManager.leaveQueue(interaction.guild.id, name, interaction.user.id)

            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Left Queue")
                        .setDescription(`You have left the queue **${name}**.\nYou have 1 minute to rejoin to keep your position.`)
                        .setColor(Colors.Yellow),
                ],
                flags: MessageFlags.Ephemeral,
            })
        } catch (error: any) {
            let errorMessage = "Failed to leave queue."
            if (error.message === "Queue not found") {
                errorMessage = `Queue **${name}** not found.`
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
