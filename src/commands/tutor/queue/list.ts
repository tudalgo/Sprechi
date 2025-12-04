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

@Discord()
@injectable()
@SlashGroup("queue", "tutor")
export class TutorQueueList {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager
  ) { }

  @Slash({ name: "list", description: "List members in the active session's queue" })
  async list(
    @SlashOption({
      name: "max_entries",
      description: "Maximum number of entries to list (default: 5)",
      required: false,
      type: ApplicationCommandOptionType.Integer,
    })
    maxEntries: number | undefined,
    interaction: CommandInteraction
  ): Promise<void> {
    logger.info(`Command 'tutor queue list' triggered by ${interaction.user.tag} (${interaction.user.id})`)

    if (!interaction.guild) return

    try {
      const activeSession = await this.queueManager.getActiveSession(interaction.guild.id, interaction.user.id)
      if (!activeSession) {
        throw new QueueError("You do not have an active session.")
      }

      const { queue } = activeSession
      const limit = maxEntries ?? 5
      const members = await this.queueManager.getQueueMembers(interaction.guild.id, queue.name, limit)

      if (members.length === 0) {
        const embed = new EmbedBuilder()
          .setTitle(`Queue: ${queue.name}`)
          .setDescription("The queue is empty.")
          .setColor(Colors.Blue)
          .setFooter({ text: "Total: 0" })

        await interaction.reply({
          embeds: [embed],
          flags: MessageFlags.Ephemeral,
        })
        return
      }

      const embed = new EmbedBuilder()
        .setTitle(`Queue: ${queue.name}`)
        .setDescription(members.map((m, i) => `${i + 1}. <@${m.userId}>`).join("\n"))
        .setColor(Colors.Blue)
        .setFooter({ text: `Showing top ${members.length} members` })

      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      })
      logger.info(`Listed ${members.length} members for queue '${queue.name}' in active session of tutor ${interaction.user.tag}`)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "An error occurred."
      logger.warn(`Failed to list queue members for tutor ${interaction.user.tag}: ${message}`)
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Error")
            .setDescription(message)
            .setColor(Colors.Red),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }
  }
}
