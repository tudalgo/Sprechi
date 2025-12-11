import { CommandInteraction, EmbedBuilder, Colors, ApplicationCommandOptionType, User, MessageFlags } from "discord.js"
import { Discord, Slash, SlashGroup, SlashOption } from "discordx"
import { QueueManager } from "@managers/QueueManager"
import { inject, injectable } from "tsyringe"

@Discord()
@injectable()
@SlashGroup("session", "admin")
export class AdminSessionTerminateCommand {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager,
  ) { }

  @Slash({ name: "terminate", description: "Terminate all sessions for a specific user", dmPermission: false })
  async terminate(
    @SlashOption({
      name: "user",
      description: "The user whose sessions to terminate",
      required: true,
      type: ApplicationCommandOptionType.User,
    })
    user: User,
    interaction: CommandInteraction,
  ) {
    if (!interaction.guildId) return

    await interaction.deferReply({ flags: MessageFlags.Ephemeral })

    const count = await this.queueManager.terminateSessionsByUser(interaction.guildId, user.id)

    if (count === 0) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Terminate Session")
            .setDescription(`No active sessions found for <@${user.id}>.`)
            .setColor(Colors.Red),
        ],
      })
      return
    }

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle("Terminate Session")
          .setDescription(`Successfully terminated **${count}** session(s) for <@${user.id}>.`)
          .setColor(Colors.Green),
      ],
    })
  }
}
