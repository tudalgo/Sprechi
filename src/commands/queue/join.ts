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
  QueueLockedError,
  AlreadyInQueueError,
  TutorCannotJoinQueueError,
  QueueError,
} from "../../errors/QueueErrors"
import logger from "@utils/logger"
import { inject, injectable } from "tsyringe"
import { queueCommands } from "@config/messages"

@Discord()
@injectable()
@SlashGroup("queue")
export class QueueJoin {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager,
  ) { }

  @Slash({ name: "join", description: queueCommands.join.description, dmPermission: false })
  async join(
    @SlashOption({
      name: "name",
      description: queueCommands.join.optionName,
      required: false,
      type: ApplicationCommandOptionType.String,
    })
    name: string | undefined,
    interaction: CommandInteraction,
  ): Promise<void> {
    logger.info(`Command 'join queue' triggered by ${interaction.user.username} (${interaction.user.id}) for queue '${name ?? "default"}'`)

    if (!interaction.guild) return

    try {
      const queue = await this.queueManager.resolveQueue(interaction.guild.id, name)
      await this.queueManager.joinQueue(interaction.guild.id, queue.name, interaction.user.id)

      logger.info(`User ${interaction.user.username} (${interaction.user.id}) joined queue '${queue.name}' in guild '${interaction.guild.name}' (${interaction.guild.id})`)

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(queueCommands.join.success.title)
            .setDescription(queueCommands.join.success.description(queue.name))
            .setColor(Colors.Green),
        ],
        flags: MessageFlags.Ephemeral,
      })
    } catch (error: unknown) {
      let errorMessage = queueCommands.join.errors.default
      if (error instanceof QueueNotFoundError) {
        errorMessage = queueCommands.join.errors.notFound(name ?? "default")
        logger.warn(`Failed to join queue: Queue '${name}' not found in guild '${interaction.guild.id}'`)
      } else if (error instanceof QueueLockedError) {
        errorMessage = queueCommands.join.errors.locked(name ?? "default")
        logger.warn(`Failed to join queue: Queue '${name}' is locked in guild '${interaction.guild.id}'`)
      } else if (error instanceof AlreadyInQueueError) {
        errorMessage = queueCommands.join.errors.alreadyInQueue(name ?? "default")
        logger.warn(`Failed to join queue: User ${interaction.user.username} already in queue '${name}' in guild '${interaction.guild.id}'`)
      } else if (error instanceof TutorCannotJoinQueueError) {
        errorMessage = queueCommands.join.errors.tutorSessionConflict
        logger.warn(`Failed to join queue: Tutor ${interaction.user.username} has active session in guild '${interaction.guild.id}'`)
      } else if (error instanceof QueueError) {
        errorMessage = error.message
        logger.warn(`Failed to join queue '${name}': ${error.message}`)
      } else {
        logger.error(`Error joining queue '${name}':`, error)
      }

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(queueCommands.join.errors.title)
            .setDescription(errorMessage)
            .setColor(Colors.Red),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }
  }
}
