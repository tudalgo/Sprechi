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

@Discord()
@SlashGroup("session", "tutor")
export class TutorSessionInfo {
  private queueManager = new QueueManager()

  @Slash({ name: "info", description: "Get information about the current session" })
  async info(interaction: CommandInteraction): Promise<void> {
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
            .setTitle("Session Info")
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to get session info."
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
