import { CommandInteraction, EmbedBuilder, Colors, MessageFlags } from "discord.js"
import { Discord, Slash, SlashGroup } from "discordx"
import { QueueManager } from "@managers/QueueManager"
import { inject, injectable } from "tsyringe"

@Discord()
@injectable()
@SlashGroup("session", "admin")
export class AdminSessionTerminateAllCommand {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager,
  ) { }

  @Slash({ name: "terminate-all", description: "Terminate ALL sessions on this server" })
  async terminateAll(interaction: CommandInteraction) {
    if (!interaction.guildId) return

    await interaction.deferReply({ flags: MessageFlags.Ephemeral })

    const count = await this.queueManager.terminateAllSessions(interaction.guildId)

    if (count === 0) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Terminate All Sessions")
            .setDescription("No active sessions found on this server.")
            .setColor(Colors.Blue),
        ],
      })
      return
    }

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle("Terminate All Sessions")
          .setDescription(`Successfully terminated **${count}** session(s) on this server.`)
          .setColor(Colors.Green),
      ],
    })
  }
}
