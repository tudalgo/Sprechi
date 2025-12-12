import { CommandInteraction, EmbedBuilder, Colors } from "discord.js"
import { Discord, Slash, SlashGroup } from "discordx"
import { QueueManager } from "@managers/QueueManager"
import { inject, injectable } from "tsyringe"
import { adminSessionCommands } from "@config/messages"

@Discord()
@injectable()
@SlashGroup({ name: "session", description: adminSessionCommands.groupDescription, root: "admin" })
export class AdminSessionListCommand {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager,
  ) { }

  @Slash({ name: "list", description: adminSessionCommands.list.description, dmPermission: false })
  @SlashGroup("session", "admin")
  async list(interaction: CommandInteraction) {
    if (!interaction.guildId) return

    await interaction.deferReply()

    const sessions = await this.queueManager.getAllActiveSessions(interaction.guildId)

    if (sessions.length === 0) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(adminSessionCommands.list.emptyState.title)
            .setDescription(adminSessionCommands.list.emptyState.description)
            .setColor(Colors.Blue),
        ],
      })
      return
    }

    const embed = new EmbedBuilder()
      .setTitle(adminSessionCommands.list.summaryTitle)
      .setColor(Colors.Blue)
      .setTimestamp()

    const fields = await Promise.all(sessions.map(async (session) => {
      const tutor = await interaction.guild!.members.fetch(session.tutorId)
      return {
        name: adminSessionCommands.list.sessionField.title(tutor.user.displayName),
        value: adminSessionCommands.list.sessionField.body(session.tutorId, session.queueName, Math.floor(session.startTime.getTime() / 1000), session.studentCount),
        inline: false,
      }
    }))

    embed.addFields(fields)

    await interaction.editReply({ embeds: [embed] })
  }
}
