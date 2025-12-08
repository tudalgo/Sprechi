import {
  ApplicationCommandOptionType,
  CommandInteraction,
  EmbedBuilder,
  Colors,
  MessageFlags,
} from "discord.js"
import { Discord, Slash, SlashGroup, SlashOption } from "discordx"
import { QueueManager } from "@managers/QueueManager"
import { inject, injectable } from "tsyringe"

@Discord()
@injectable()
@SlashGroup("admin")
@SlashGroup("queue", "admin")
export class AdminQueueAutoLockCommand {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager,
  ) { }

  @Slash({ name: "auto-lock", description: "Enable automatic locking based on schedule" })
  async autoLock(
    @SlashOption({
      name: "name",
      description: "The name of the queue",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    name: string,
    interaction: CommandInteraction,
  ): Promise<void> {
    if (!interaction.guildId) return

    await interaction.deferReply({ flags: MessageFlags.Ephemeral })

    try {
      await this.queueManager.setScheduleEnabled(interaction.guildId, name, true)

      // Trigger check immediately to update state
      await this.queueManager.checkSchedules()

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Auto Mode Enabled")
            .setDescription(`Enabled automatic scheduling for queue **${name}**.`)
            .setColor(Colors.Green),
        ],
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "An error occurred."
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Error")
            .setDescription(message)
            .setColor(Colors.Red),
        ],
      })
    }
  }
}
