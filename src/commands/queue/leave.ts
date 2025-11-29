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
  NotInQueueError,
  QueueError,
} from "../../errors/QueueErrors"

@Discord()
@SlashGroup("queue")
export class QueueLeave {
  private queueManager = new QueueManager()

  @Slash({ name: "leave", description: "Leave a queue" })
  async leave(
    @SlashOption({
      name: "name",
      description: "The name of the queue to leave",
      required: false,
      type: ApplicationCommandOptionType.String,
    })
    name: string | undefined,
    interaction: CommandInteraction,
  ): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        flags: MessageFlags.Ephemeral,
      })
      return
    }

    try {
      let queueName = name
      if (!queueName) {
        const currentQueue = await this.queueManager.getQueueByUser(interaction.guild.id, interaction.user.id)
        if (currentQueue) {
          queueName = currentQueue.name
        } else {
          // If not in any queue, try to resolve default queue to show correct error
          const queue = await this.queueManager.resolveQueue(interaction.guild.id)
          queueName = queue.name
        }
      }

      await this.queueManager.leaveQueue(interaction.guild.id, queueName!, interaction.user.id)

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Left Queue")
            .setDescription(`You have left the queue **${queueName}**.\nYou have 1 minute to rejoin to keep your position.`)
            .setColor(Colors.Yellow),
        ],
        flags: MessageFlags.Ephemeral,
      })
    } catch (error: any) {
      let errorMessage = "Failed to leave queue."
      if (error instanceof QueueNotFoundError) {
        errorMessage = `Queue **${name}** not found.`
      } else if (error instanceof NotInQueueError) {
        errorMessage = `You are not in queue **${name ?? "any queue"}**.`
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
