import {
  CommandInteraction,
  EmbedBuilder,
  Colors,
  MessageFlags,
} from "discord.js"
import { Discord, Slash, SlashGroup } from "discordx"
import { QueueManager } from "@managers/QueueManager"
import logger from "@utils/logger"
import { inject, injectable } from "tsyringe"

@Discord()
@injectable()
@SlashGroup({ name: "tutor", description: "Tutor commands" })
@SlashGroup({ name: "session", description: "Session management", root: "tutor" })
export class TutorSessionEnd {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager,
  ) { }

  @Slash({ name: "end", description: "End your tutoring session", dmPermission: false })
  @SlashGroup("session", "tutor")
  async end(interaction: CommandInteraction): Promise<void> {
    if (!interaction.guild) return

    logger.info(`Command 'tutor session end' triggered by ${interaction.user.username} (${interaction.user.id})`)
    try {
      await this.queueManager.endSession(interaction.guild.id, interaction.user.id)

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Session Ended")
            .setDescription("You have ended your session.")
            .setColor(Colors.Yellow),
        ],
        flags: MessageFlags.Ephemeral,
      })
      logger.info(`Tutor ${interaction.user.username} ended their session in guild '${interaction.guild.name}' (${interaction.guild.id})`)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to end session."
      logger.warn(`Failed to end session for tutor ${interaction.user.username}: ${message}`)
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
