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
export class AdminQueueScheduleRemoveCommand {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager,
  ) { }

  @Slash({ name: "schedule-remove", description: adminQueueCommands.schedule.remove.description, dmPermission: false })
  async remove(
    @SlashOption({
      name: "name",
      description: adminQueueCommands.schedule.remove.optionName,
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    name: string,
    @SlashOption({
      name: "day",
      description: adminQueueCommands.schedule.remove.optionDay,
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    dayInput: string,
    interaction: CommandInteraction,
  ): Promise<void> {
    if (!interaction.guildId) return

    await interaction.deferReply()

    try {
      // Delegate day parsing to QueueManager
      const day = this.queueManager.parseDayOfWeek(dayInput)

      await this.queueManager.removeSchedule(interaction.guildId, name, day)

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(adminQueueCommands.schedule.remove.success.title)
            .setDescription(adminQueueCommands.schedule.remove.success.description(name, dayInput))
            .setColor(Colors.Green),
        ],
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "An error occurred."
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(adminQueueCommands.schedule.remove.errors.title)
            .setDescription(message)
            .setColor(Colors.Red),
        ],
      })
    }
  }
}
