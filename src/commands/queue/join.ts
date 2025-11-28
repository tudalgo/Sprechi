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
export class QueueJoin {
    private queueManager = new QueueManager()

    @Slash({ name: "join", description: "Join a queue" })
    async join(
        @SlashOption({
            name: "name",
            description: "The name of the queue to join",
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
            await this.queueManager.joinQueue(interaction.guild.id, name, interaction.user.id)

            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Joined Queue")
                        .setDescription(`You have joined the queue **${name}**.`)
                        .setColor(Colors.Green),
                ],
                flags: MessageFlags.Ephemeral,
            })
        } catch (error: any) {
            let errorMessage = "Failed to join queue."
            if (error.message === "Queue not found") {
                errorMessage = `Queue **${name}** not found.`
            } else if (error.message === "Queue is locked") {
                errorMessage = `Queue **${name}** is locked.`
            } else if (error.message === "Already in queue") {
                errorMessage = `You are already in queue **${name}**.`
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
