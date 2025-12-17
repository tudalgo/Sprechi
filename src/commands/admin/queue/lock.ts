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
export class AdminQueueLockCommand {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager,
  ) { }

  @Slash({ name: "lock", description: adminQueueCommands.lock.description, dmPermission: false })
  async lock(
    @SlashOption({
      name: "name",
      description: adminQueueCommands.lock.optionName,
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    name: string,
    interaction: CommandInteraction,
  ): Promise<void> {
    if (!interaction.guildId) return

    await interaction.deferReply()

    try {
      await this.queueManager.setScheduleEnabled(interaction.guildId, name, false)
      await this.queueManager.setQueueLockState(interaction.guildId, name, true)

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(adminQueueCommands.lock.success.title)
            .setDescription(adminQueueCommands.lock.success.description(name))
            .setColor(Colors.Red),
        ],
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "An error occurred."
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(adminQueueCommands.lock.errors.title)
            .setDescription(message)
            .setColor(Colors.Red),
        ],
      })
    }
  }
}
