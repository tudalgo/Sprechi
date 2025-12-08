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

  @Slash({ name: "schedule-add", description: "Add a schedule to a queue" })
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
      const days: Record<string, number> = {
        sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6
      }
      const day = days[dayInput.toLowerCase()]
      if (day === undefined) {
        throw new Error("Invalid day of week. Please use full English names (e.g. Monday).")
      }

      // Validate time format HH:mm
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
      if (!timeRegex.test(start) || !timeRegex.test(end)) {
        throw new Error("Invalid time format. Please use HH:mm (24-hour format).")
      }

      const [startH, startM] = start.split(":").map(Number)
      const [endH, endM] = end.split(":").map(Number)
      const startTotal = startH * 60 + startM
      const endTotal = endH * 60 + endM

      if (startTotal >= endTotal) {
        throw new Error("Start time must be before end time.")
      }

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
