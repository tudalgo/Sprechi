import {
  CommandInteraction,
  EmbedBuilder,
  Colors,
  MessageFlags,
} from "discord.js"
import { Discord, Slash, SlashGroup } from "discordx"
import { QueueManager } from "@managers/QueueManager"
import { QueueError } from "../../../errors/QueueErrors"
import db from "@db"
import { sessionStudents } from "@db/schema"
import { eq, sql } from "drizzle-orm"
import logger from "@utils/logger"
import { inject, injectable } from "tsyringe"

@Discord()
@injectable()
@SlashGroup("session", "tutor")
export class TutorSessionSummary {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager,
  ) { }

  @Slash({ name: "summary", description: "Get summary of the current session" })
  async summary(interaction: CommandInteraction): Promise<void> {
    logger.info(`Command 'tutor session summary' triggered by ${interaction.user.username} (${interaction.user.id})`)

    if (!interaction.guild) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        flags: MessageFlags.Ephemeral,
      })
      return
    }

    try {
      const activeSession = await this.queueManager.getActiveSession(interaction.guild.id, interaction.user.id)
      if (!activeSession) {
        throw new QueueError("You do not have an active session.")
      }

      const { session, queue } = activeSession
      const startTime = new Date(session.startTime)
      const durationMs = new Date().getTime() - startTime.getTime()
      const durationMinutes = Math.floor(durationMs / 60000)

      // Count students helped
      const [studentCount] = await db.select({ count: sql<number>`count(*)` })
        .from(sessionStudents)
        .where(eq(sessionStudents.sessionId, session.id))

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Session Summary")
            .addFields(
              { name: "Queue", value: queue.name, inline: true },
              { name: "Started", value: `<t:${Math.floor(startTime.getTime() / 1000)}:R>`, inline: true },
              { name: "Duration", value: `${durationMinutes} minutes`, inline: true },
              { name: "Students Helped", value: String(studentCount?.count ?? 0), inline: true },
            )
            .setColor(Colors.Blue),
        ],
        flags: MessageFlags.Ephemeral,
      })
      logger.info(`Displayed session info for tutor ${interaction.user.username} in guild '${interaction.guild.name}' (${interaction.guild.id})`)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to get session info."
      logger.warn(`Failed to get session info for tutor ${interaction.user.username}: ${message}`)
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
