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
export class AdminQueueScheduleRemoveCommand {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager,
  ) { }

  @Slash({ name: "schedule-remove", description: "Remove a schedule from a queue", dmPermission: false })
  async remove(
    @SlashOption({
      name: "name",
      description: "The name of the queue",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    name: string,
    @SlashOption({
      name: "day",
      description: "Day of the week (e.g. Monday)",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    dayInput: string,
    interaction: CommandInteraction,
  ): Promise<void> {
    if (!interaction.guildId) return

    await interaction.deferReply({ flags: MessageFlags.Ephemeral })

    try {
      // Delegate day parsing to QueueManager
      const day = this.queueManager.parseDayOfWeek(dayInput)

      await this.queueManager.removeSchedule(interaction.guildId, name, day)

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Schedule Removed")
            .setDescription(`Removed schedule for queue **${name}** on **${dayInput}**.`)
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
