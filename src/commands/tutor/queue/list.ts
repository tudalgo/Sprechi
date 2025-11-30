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

@Discord()
@SlashGroup("queue", "tutor")
export class TutorQueueList {
  private queueManager = new QueueManager()

  @Slash({ name: "list", description: "List members in the active session's queue" })
  async list(interaction: CommandInteraction): Promise<void> {
    logger.info(`Command 'tutor queue list' triggered by ${interaction.user.tag} (${interaction.user.id})`)

    if (!interaction.guild) return

    try {
      const activeSession = await this.queueManager.getActiveSession(interaction.guild.id, interaction.user.id)
      if (!activeSession) {
        throw new QueueError("You do not have an active session.")
      }

      const { queue } = activeSession
      const members = await this.queueManager.getQueueMembers(interaction.guild.id, queue.name)

      if (members.length === 0) {
        await interaction.reply({
          content: `The queue **${queue.name}** is empty.`,
          flags: MessageFlags.Ephemeral,
        })
        return
      }

      const embed = new EmbedBuilder()
        .setTitle(`Queue: ${queue.name}`)
        .setDescription(members.map((m, i) => `${i + 1}. <@${m.userId}>`).join("\n"))
        .setColor(Colors.Blue)
        .setFooter({ text: `Total: ${members.length}` })

      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      })
      logger.info(`Listed ${members.length} members for queue '${queue.name}' in active session of tutor ${interaction.user.tag}`)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "An error occurred."
      logger.warn(`Failed to list queue members for tutor ${interaction.user.tag}: ${message}`)
      await interaction.reply({
        content: message,
        flags: MessageFlags.Ephemeral,
      })
    }
  }
}
