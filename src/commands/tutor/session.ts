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
  SessionAlreadyActiveError,
  QueueError,
} from "../../errors/QueueErrors"
import db from "@db"
import { sessionStudents } from "@db/schema"
import { eq, sql } from "drizzle-orm"

@Discord()
@SlashGroup({ name: "tutor", description: "Tutor commands" })
@SlashGroup({ name: "session", description: "Session management", root: "tutor" })
export class TutorSession {
  private queueManager = new QueueManager()

  @Slash({ name: "start", description: "Start a tutoring session" })
  @SlashGroup("session", "tutor")
  async start(
    @SlashOption({
      name: "queue",
      description: "The name of the queue (optional)",
      required: false,
      type: ApplicationCommandOptionType.String,
    })
    name: string | undefined,
    interaction: CommandInteraction,
  ): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        flags: MessageFlags.Ephemeral,
      })
      return
    }

    try {
      const queue = await this.queueManager.resolveQueue(interaction.guild.id, name)
      await this.queueManager.createSession(interaction.guild.id, queue.name, interaction.user.id)

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Session Started")
            .setDescription(`You have started a session on queue **${queue.name}**.`)
            .setColor(Colors.Green),
        ],
        flags: MessageFlags.Ephemeral,
      })
    } catch (error: unknown) {
      let errorMessage = "Failed to start session."
      if (error instanceof QueueNotFoundError) {
        errorMessage = `Queue **${name}** not found.`
      } else if (error instanceof SessionAlreadyActiveError) {
        errorMessage = "You already have an active session."
      } else if (error instanceof QueueError) {
        errorMessage = error.message
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

  @Slash({ name: "end", description: "End your tutoring session" })
  @SlashGroup("session", "tutor")
  async end(interaction: CommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        flags: MessageFlags.Ephemeral,
      })
      return
    }

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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to end session."
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

  @Slash({ name: "info", description: "Get information about the current session" })
  @SlashGroup("session", "tutor")
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
