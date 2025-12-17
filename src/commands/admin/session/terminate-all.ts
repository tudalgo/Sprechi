import { CommandInteraction, EmbedBuilder, Colors, MessageFlags } from "discord.js"
import { Discord, Slash, SlashGroup } from "discordx"
import { QueueManager } from "@managers/QueueManager"
import { inject, injectable } from "tsyringe"
import { adminSessionCommands } from "@config/messages"

@Discord()
@injectable()
@SlashGroup("session", "admin")
export class AdminSessionTerminateAllCommand {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager,
  ) { }

  @Slash({ name: "terminate-all", description: adminSessionCommands.terminateAll.description, dmPermission: false })
  async terminateAll(interaction: CommandInteraction) {
    if (!interaction.guildId) return

    await interaction.deferReply({ flags: MessageFlags.Ephemeral })

    const count = await this.queueManager.terminateAllSessions(interaction.guildId)

    if (count === 0) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(adminSessionCommands.terminateAll.emptyState.title)
            .setDescription(adminSessionCommands.terminateAll.emptyState.description)
            .setColor(Colors.Blue),
        ],
      })
      return
    }

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle(adminSessionCommands.terminateAll.success.title)
          .setDescription(adminSessionCommands.terminateAll.success.description(count))
          .setColor(Colors.Green),
      ],
    })
  }
}
