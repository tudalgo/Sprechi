import { CommandInteraction, EmbedBuilder, Colors, MessageFlags } from "discord.js"
import { Discord, Slash, SlashGroup } from "discordx"
import db from "@db"
import { sessions, sessionStudents } from "@db/schema"
import { eq, sql } from "drizzle-orm"
import logger from "@utils/logger"
import { injectable } from "tsyringe"

@Discord()
@injectable()
@SlashGroup("tutor")
export class TutorSummaryCommand {

  @Slash({ name: "summary", description: "Get an overview of your tutoring sessions" })
  async summary(interaction: CommandInteraction): Promise<void> {
    logger.info(`Command 'tutor summary' triggered by ${interaction.user.username} (${interaction.user.id})`)

    if (!interaction.guild) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        flags: MessageFlags.Ephemeral,
      })
      return
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral })

    try {
      // Fetch all sessions for the tutor
      const tutorSessions = await db.select()
        .from(sessions)
        .where(eq(sessions.tutorId, interaction.user.id))

      let totalSessions = tutorSessions.length
      let totalTimeMs = 0
      let totalStudentsHelped = 0

      for (const session of tutorSessions) {
        // Calculate duration
        const startTime = new Date(session.startTime)
        const endTime = session.endTime ? new Date(session.endTime) : new Date()
        totalTimeMs += endTime.getTime() - startTime.getTime()

        // Count students for this session
        const [studentCount] = await db.select({ count: sql<number>`count(*)` })
          .from(sessionStudents)
          .where(eq(sessionStudents.sessionId, session.id))

        totalStudentsHelped += Number(studentCount?.count ?? 0)
      }

      const totalHours = Math.floor(totalTimeMs / 3600000)
      const totalMinutes = Math.floor((totalTimeMs % 3600000) / 60000)

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Tutor Summary")
            .setDescription(`Overview of your tutoring stats.`)
            .addFields(
              { name: "Total Sessions", value: String(totalSessions), inline: true },
              { name: "Total Time", value: `${totalHours}h ${totalMinutes}m`, inline: true },
              { name: "Students Helped", value: String(totalStudentsHelped), inline: true },
            )
            .setColor(Colors.Blue)
            .setTimestamp(),
        ],
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to get tutor summary."
      logger.error(`Failed to get tutor summary for ${interaction.user.username}: ${message}`)
      await interaction.editReply({
        content: "An error occurred while fetching your summary."
      })
    }
  }
}
