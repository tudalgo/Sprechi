import {
  ApplicationCommandOptionType,
  CommandInteraction,
  EmbedBuilder,
  Colors,
} from "discord.js"
import { Discord, Slash, SlashGroup, SlashOption } from "discordx"
import { QueueManager } from "@managers/QueueManager"
import { inject, injectable } from "tsyringe"
import { adminQueueCommands } from "@config/messages"

@Discord()
@injectable()
@SlashGroup("queue", "admin")
export class AdminQueueAutoLockCommand {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager,
  ) { }

  @Slash({ name: "auto-lock", description: adminQueueCommands.autoLock.description, dmPermission: false })
  async autoLock(
    @SlashOption({
      name: "name",
      description: adminQueueCommands.autoLock.optionName,
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    name: string,
    interaction: CommandInteraction,
  ): Promise<void> {
    if (!interaction.guildId) return

    await interaction.deferReply()

    try {
      await this.queueManager.setScheduleEnabled(interaction.guildId, name, true)

      // Trigger check immediately to update state
      await this.queueManager.checkSchedules()

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(adminQueueCommands.autoLock.success.title)
            .setDescription(adminQueueCommands.autoLock.success.description(name))
            .setColor(Colors.Green),
        ],
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "An error occurred."
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(adminQueueCommands.autoLock.errors.title)
            .setDescription(message)
            .setColor(Colors.Red),
        ],
      })
    }
  }
}
