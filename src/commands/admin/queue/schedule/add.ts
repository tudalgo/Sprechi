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
export class AdminQueueScheduleAddCommand {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager,
  ) { }

  @Slash({ name: "schedule-add", description: "Add a schedule to a queue", dmPermission: false })
  async add(
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
    @SlashOption({
      name: "start",
      description: "Start time (HH:mm)",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    start: string,
    @SlashOption({
      name: "end",
      description: "End time (HH:mm)",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    end: string,
    interaction: CommandInteraction,
  ): Promise<void> {
    if (!interaction.guildId) return

    await interaction.deferReply({ flags: MessageFlags.Ephemeral })

    try {
      // Delegate all validation to QueueManager
      const day = this.queueManager.parseDayOfWeek(dayInput)
      this.queueManager.validateTimeFormat(start)
      this.queueManager.validateTimeFormat(end)
      this.queueManager.validateTimeRange(start, end)

      await this.queueManager.addSchedule(interaction.guildId, name, day, start, end)

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Schedule Added")
            .setDescription(`Added schedule for queue **${name}** on **${dayInput}**: ${start} - ${end}.`)
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
