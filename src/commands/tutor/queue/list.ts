import {
  CommandInteraction,
  EmbedBuilder,
  Colors,
  MessageFlags,
  ApplicationCommandOptionType,
} from "discord.js"
import { Discord, Slash, SlashGroup, SlashOption } from "discordx"
import { QueueManager } from "@managers/QueueManager"
import { QueueError } from "@errors/QueueErrors"
import logger from "@utils/logger"
import { inject, injectable } from "tsyringe"
import { tutorQueueCommands } from "@config/messages"

@Discord()
@injectable()
@SlashGroup("queue", "tutor")
export class TutorQueueList {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager,
  ) { }

  @Slash({ name: "list", description: tutorQueueCommands.list.description, dmPermission: false })
  async list(
    @SlashOption({
      name: "max_entries",
      description: tutorQueueCommands.list.optionMaxEntries,
      required: false,
      type: ApplicationCommandOptionType.Integer,
    })
    maxEntries: number | undefined,
    interaction: CommandInteraction,
  ): Promise<void> {
    logger.info(`Command 'tutor queue list' triggered by ${interaction.user.username} (${interaction.user.id})`)

    if (!interaction.guild) return

    try {
      const activeSession = await this.queueManager.getActiveSession(interaction.guild.id, interaction.user.id)
      if (!activeSession) {
        throw new QueueError("You do not have an active session.")
      }

      const { queue } = activeSession
      const limit = maxEntries ?? 5

      const embed = await this.queueManager.getQueueListEmbed(interaction.guild.id, queue.name, limit)

      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      })
      logger.info(`Listed members for queue '${queue.name}' in active session of tutor ${interaction.user.username}`)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "An error occurred."
      logger.warn(`Failed to list queue members for tutor ${interaction.user.username}: ${message}`)
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(tutorQueueCommands.list.errors.title)
            .setDescription(message)
            .setColor(Colors.Red),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }
  }
}
