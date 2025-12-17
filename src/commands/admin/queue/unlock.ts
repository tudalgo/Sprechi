import { CommandInteraction, ApplicationCommandOptionType, EmbedBuilder, Colors } from "discord.js"
import { Discord, Slash, SlashOption, SlashGroup } from "discordx"
import { QueueManager } from "@managers/QueueManager"
import { inject, injectable } from "tsyringe"
import { adminQueueCommands } from "@config/messages"

@Discord()
@injectable()
@SlashGroup("queue", "admin")
export class AdminQueueUnlockCommand {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager,
  ) { }

  @Slash({ name: "unlock", description: adminQueueCommands.unlock.description, dmPermission: false })
  async unlock(
    @SlashOption({
      name: "name",
      description: adminQueueCommands.unlock.optionName,
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    name: string,
    interaction: CommandInteraction,
  ) {
    if (!interaction.guildId) return

    await interaction.deferReply()

    try {
      await this.queueManager.setScheduleEnabled(interaction.guildId, name, false)
      await this.queueManager.setQueueLockState(interaction.guildId, name, false)

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(adminQueueCommands.unlock.success.title)
            .setDescription(adminQueueCommands.unlock.success.description(name))
            .setColor(Colors.Green),
        ],
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "An error occurred."
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(adminQueueCommands.unlock.errors.title)
            .setDescription(message)
            .setColor(Colors.Red),
        ],
      })
    }
  }
}
