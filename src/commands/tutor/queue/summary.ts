import {
  CommandInteraction,
  EmbedBuilder,
  Colors,
  MessageFlags,
} from "discord.js"
import { Discord, Slash, SlashGroup } from "discordx"
import { QueueManager } from "@managers/QueueManager"
import { QueueError } from "@errors/QueueErrors"
import logger from "@utils/logger"
import { inject, injectable } from "tsyringe"

@Discord()
@injectable()
@SlashGroup("queue", "tutor")
export class TutorQueueSummary {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager,
  ) { }

  @Slash({ name: "summary", description: "Show summary of the active session's queue" })
  async summary(interaction: CommandInteraction): Promise<void> {
    logger.info(`Command 'tutor queue summary' triggered by ${interaction.user.username} (${interaction.user.id})`)

    if (!interaction.guild) return

    try {
      const activeSession = await this.queueManager.getActiveSession(interaction.guild.id, interaction.user.id)
      if (!activeSession) {
        throw new QueueError("You do not have an active session.")
      }

      const { queue } = activeSession

      // Get queue stats
      const allQueues = await this.queueManager.listQueues(interaction.guild.id)
      const queueStats = allQueues.find(q => q.id === queue.id)

      if (!queueStats) {
        throw new QueueError("Queue not found.")
      }

      const embed = new EmbedBuilder()
        .setTitle(`Queue Summary: ${queue.name}`)
        .setDescription(queue.description || "No description.")
        .addFields(
          { name: "Students in Queue", value: String(queueStats.memberCount), inline: true },
          { name: "Active Sessions", value: String(queueStats.sessionCount), inline: true },
        )
        .setColor(Colors.Blue)
        .setFooter({ text: `Queue ID: ${queue.id}` })

      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      })
      logger.info(`Shown summary for queue '${queue.name}' to tutor ${interaction.user.username}`)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "An error occurred."
      logger.warn(`Failed to show queue summary for tutor ${interaction.user.username}: ${message}`)
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
