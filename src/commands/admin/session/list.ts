import { CommandInteraction, EmbedBuilder, Colors } from "discord.js"
import { Discord, Slash, SlashGroup } from "discordx"
import { QueueManager } from "@managers/QueueManager"
import { inject, injectable } from "tsyringe"

@Discord()
@injectable()
@SlashGroup({ name: "session", description: "Manage sessions", root: "admin" })
export class AdminSessionListCommand {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager,
  ) { }

  @Slash({ name: "list", description: "List all active sessions" })
  @SlashGroup("session", "admin")
  async list(interaction: CommandInteraction) {
    if (!interaction.guildId) return

    await interaction.deferReply()

    const sessions = await this.queueManager.getAllActiveSessions(interaction.guildId)

    if (sessions.length === 0) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Active Sessions")
            .setDescription("There are no active sessions on this server.")
            .setColor(Colors.Blue),
        ],
      })
      return
    }

    const embed = new EmbedBuilder()
      .setTitle("Active Sessions")
      .setColor(Colors.Blue)
      .setTimestamp()

    const fields = await Promise.all(sessions.map(async (session) => {
      const tutor = await interaction.guild!.members.fetch(session.tutorId)
      return {
        name: `Tutor: ${tutor.user.displayName}`,
        value: `- **User:** <@${session.tutorId}>\n- **Queue:** ${session.queueName}\n- **Started:** <t:${Math.floor(session.startTime.getTime() / 1000)}:R>\n- **Students Helped:** ${session.studentCount}`,
        inline: false,
      }
    }))

    embed.addFields(fields)

    await interaction.editReply({ embeds: [embed] })
  }
}
