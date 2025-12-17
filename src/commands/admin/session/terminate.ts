import { CommandInteraction, EmbedBuilder, Colors, ApplicationCommandOptionType, User, MessageFlags } from "discord.js"
import { Discord, Slash, SlashGroup, SlashOption } from "discordx"
import { QueueManager } from "@managers/QueueManager"
import { inject, injectable } from "tsyringe"
import { adminSessionCommands } from "@config/messages"

@Discord()
@injectable()
@SlashGroup("session", "admin")
export class AdminSessionTerminateCommand {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager,
  ) { }

  @Slash({ name: "terminate", description: adminSessionCommands.terminate.description, dmPermission: false })
  async terminate(
    @SlashOption({
      name: "user",
      description: adminSessionCommands.terminate.optionUser,
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
            .setTitle(adminSessionCommands.terminate.emptyState.title)
            .setDescription(adminSessionCommands.terminate.emptyState.description(user.id))
            .setColor(Colors.Red),
        ],
      })
      return
    }

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle(adminSessionCommands.terminate.success.title)
          .setDescription(adminSessionCommands.terminate.success.description(count, user.id))
          .setColor(Colors.Green),
      ],
    })
  }
}
