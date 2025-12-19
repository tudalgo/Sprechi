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
import { queueCommands } from "@config/messages"

@Discord()
@injectable()
@SlashGroup("queue")
export class QueueLeave {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager,
  ) { }

  @Slash({ name: "leave", description: queueCommands.leave.description, dmPermission: false })
  async leave(
    @SlashOption({
      name: "name",
      description: queueCommands.leave.optionName,
      required: false,
      type: ApplicationCommandOptionType.String,
    })
    name: string | undefined,
    interaction: CommandInteraction,
  ): Promise<void> {
    logger.info(`Command 'leave queue' triggered by ${interaction.user.username} (${interaction.user.id}) for queue '${name ?? "auto-detect"}'`)

    if (!interaction.guild) return

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
            .setTitle(queueCommands.leave.success.title)
            .setDescription(queueCommands.leave.success.description(queueName))
            .setColor(Colors.Yellow),
        ],
        flags: MessageFlags.Ephemeral,
      })
    } catch (error: unknown) {
      let errorMessage = queueCommands.leave.errors.default
      if (error instanceof QueueNotFoundError) {
        errorMessage = queueCommands.leave.errors.notFound(name ?? "default")
        logger.warn(`Failed to leave queue: Queue '${name}' not found in guild '${interaction.guild.id}'`)
      } else if (error instanceof NotInQueueError) {
        errorMessage = queueCommands.leave.errors.notInQueue(name ?? null)
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
            .setTitle(queueCommands.leave.errors.title)
            .setDescription(errorMessage)
            .setColor(Colors.Red),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }
  }
}
