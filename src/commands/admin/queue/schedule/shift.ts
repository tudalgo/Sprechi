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
export class AdminQueueScheduleShiftCommand {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager,
  ) { }

  @Slash({ name: "schedule-shift", description: adminQueueCommands.schedule.shift.description, dmPermission: false })
  async shift(
    @SlashOption({
      name: "name",
      description: adminQueueCommands.schedule.shift.optionName,
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    name: string,
    @SlashOption({
      name: "minutes",
      description: adminQueueCommands.schedule.shift.optionMinutes,
      required: true,
      type: ApplicationCommandOptionType.Integer,
    })
    minutes: number,
    interaction: CommandInteraction,
  ): Promise<void> {
    if (!interaction.guildId) return

    await interaction.deferReply()

    try {
      await this.queueManager.setScheduleShift(interaction.guildId, name, minutes)

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(adminQueueCommands.schedule.shift.success.title)
            .setDescription(adminQueueCommands.schedule.shift.success.description(name, minutes))
            .setColor(Colors.Green),
        ],
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "An error occurred."
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(adminQueueCommands.schedule.shift.errors.title)
            .setDescription(message)
            .setColor(Colors.Red),
        ],
      })
    }
  }
}
