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
import logger from "@utils/logger"
import { inject, injectable } from "tsyringe"

@Discord()
@injectable()
@SlashGroup("queue")
export class QueueLeave {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager
  ) { }

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
    logger.info(`Command 'leave queue' triggered by ${interaction.user.username} (${interaction.user.id}) for queue '${name ?? "auto-detect"}'`)

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

      logger.info(`User ${interaction.user.username} (${interaction.user.id}) left queue '${queueName}' in guild '${interaction.guild.name}' (${interaction.guild.id})`)

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Left Queue")
            .setDescription(`You have left the queue **${queueName}**.\nYou have 1 minute to rejoin to keep your position.`)
            .setColor(Colors.Yellow),
        ],
        flags: MessageFlags.Ephemeral,
      })
    } catch (error: unknown) {
      let errorMessage = "Failed to leave queue."
      if (error instanceof QueueNotFoundError) {
        errorMessage = `Queue **${name}** not found.`
        logger.warn(`Failed to leave queue: Queue '${name}' not found in guild '${interaction.guild.id}'`)
      } else if (error instanceof NotInQueueError) {
        errorMessage = `You are not in queue **${name ?? "any queue"}**.`
        logger.warn(`Failed to leave queue: User ${interaction.user.username} not in queue '${name ?? "any"}' in guild '${interaction.guild.id}'`)
      } else if (error instanceof QueueError) {
        errorMessage = error.message
        logger.warn(`Failed to leave queue '${name}': ${error.message}`)
      } else {
        logger.error(`Error leaving queue '${name}':`, error)
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
