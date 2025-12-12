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
export class AdminQueueScheduleAddCommand {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager,
  ) { }

  @Slash({ name: "schedule-add", description: adminQueueCommands.schedule.add.description, dmPermission: false })
  async add(
    @SlashOption({
      name: "name",
      description: adminQueueCommands.schedule.add.optionName,
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    name: string,
    @SlashOption({
      name: "day",
      description: adminQueueCommands.schedule.add.optionDay,
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    dayInput: string,
    @SlashOption({
      name: "start",
      description: adminQueueCommands.schedule.add.optionStart,
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    start: string,
    @SlashOption({
      name: "end",
      description: adminQueueCommands.schedule.add.optionEnd,
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    end: string,
    interaction: CommandInteraction,
  ): Promise<void> {
    if (!interaction.guildId) return

    await interaction.deferReply()

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
            .setTitle(adminQueueCommands.schedule.add.success.title)
            .setDescription(adminQueueCommands.schedule.add.success.description(name, dayInput, start, end))
            .setColor(Colors.Green),
        ],
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "An error occurred."
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(adminQueueCommands.schedule.add.errors.title)
            .setDescription(message)
            .setColor(Colors.Red),
        ],
      })
    }
  }
}
