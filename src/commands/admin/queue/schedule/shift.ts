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
@SlashGroup("queue", "admin")
export class AdminQueueScheduleShiftCommand {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager,
  ) { }

  @Slash({ name: "schedule-shift", description: "Set start/end time shift", dmPermission: false })
  async shift(
    @SlashOption({
      name: "name",
      description: "The name of the queue",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    name: string,
    @SlashOption({
      name: "minutes",
      description: "Shift in minutes (positive = earlier, negative = later)",
      required: true,
      type: ApplicationCommandOptionType.Integer,
    })
    minutes: number,
    interaction: CommandInteraction,
  ): Promise<void> {
    if (!interaction.guildId) return

    await interaction.deferReply({ flags: MessageFlags.Ephemeral })

    try {
      await this.queueManager.setScheduleShift(interaction.guildId, name, minutes)

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Schedule Shift Set")
            .setDescription(`Set schedule shift for queue **${name}** to **${minutes} minutes**.`)
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
