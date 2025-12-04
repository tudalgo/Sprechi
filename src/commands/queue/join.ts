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

@Discord()
@injectable()
@SlashGroup("queue")
export class QueueJoin {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager
  ) { }

  @Slash({ name: "join", description: "Join a queue" })
  async join(
    @SlashOption({
      name: "name",
      description: "The name of the queue to join",
      required: false,
      type: ApplicationCommandOptionType.String,
    })
    name: string | undefined,
    interaction: CommandInteraction,
  ): Promise<void> {
    logger.info(`Command 'join queue' triggered by ${interaction.user.tag} (${interaction.user.id}) for queue '${name ?? "default"}'`)

    if (!interaction.guild) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        flags: MessageFlags.Ephemeral,
      })
      return
    }

    try {
      const queue = await this.queueManager.resolveQueue(interaction.guild.id, name)
      await this.queueManager.joinQueue(interaction.guild.id, queue.name, interaction.user.id)

      logger.info(`User ${interaction.user.tag} (${interaction.user.id}) joined queue '${queue.name}' in guild '${interaction.guild.name}' (${interaction.guild.id})`)

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Joined Queue")
            .setDescription(`You have joined the queue **${queue.name}**.`)
            .setColor(Colors.Green),
        ],
        flags: MessageFlags.Ephemeral,
      })
    } catch (error: unknown) {
      let errorMessage = "Failed to join queue."
      if (error instanceof QueueNotFoundError) {
        errorMessage = `Queue **${name}** not found.`
        logger.warn(`Failed to join queue: Queue '${name}' not found in guild '${interaction.guild.id}'`)
      } else if (error instanceof QueueLockedError) {
        errorMessage = `Queue **${name}** is locked.`
        logger.warn(`Failed to join queue: Queue '${name}' is locked in guild '${interaction.guild.id}'`)
      } else if (error instanceof AlreadyInQueueError) {
        errorMessage = `You are already in queue **${name}**.`
        logger.warn(`Failed to join queue: User ${interaction.user.tag} already in queue '${name}' in guild '${interaction.guild.id}'`)
      } else if (error instanceof TutorCannotJoinQueueError) {
        errorMessage = "You cannot join a queue while you have an active tutor session."
        logger.warn(`Failed to join queue: Tutor ${interaction.user.tag} has active session in guild '${interaction.guild.id}'`)
      } else if (error instanceof QueueError) {
        errorMessage = error.message
        logger.warn(`Failed to join queue '${name}': ${error.message}`)
      } else {
        logger.error(`Error joining queue '${name}':`, error)
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
