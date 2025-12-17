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
export class AdminQueueScheduleSummaryCommand {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager,
  ) { }

  @Slash({ name: "schedule-summary", description: adminQueueCommands.schedule.summary.description, dmPermission: false })
  async summary(
    @SlashOption({
      name: "name",
      description: adminQueueCommands.schedule.summary.optionName,
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    name: string,
    @SlashOption({
      name: "hide-private-info",
      description: adminQueueCommands.schedule.summary.optionHidePrivateInfo,
      required: false,
      type: ApplicationCommandOptionType.Boolean,
    })
    hidePrivateInfo: boolean,
    interaction: CommandInteraction,
  ): Promise<void> {
    if (!interaction.guildId) return

    await interaction.deferReply()

    try {
      const queue = await this.queueManager.getQueueByName(interaction.guildId, name)
      const schedules = await this.queueManager.getSchedules(interaction.guildId, name)

      const autoLockInfo = hidePrivateInfo ? "" : adminQueueCommands.schedule.summary.autoLockInfo(queue.scheduleEnabled)

      if (schedules.length === 0) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle(adminQueueCommands.schedule.summary.emptySchedule.title(name))
              .setDescription(adminQueueCommands.schedule.summary.emptySchedule.description(autoLockInfo))
              .setColor(Colors.Orange),
          ],
        })
        return
      }

      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
      const scheduleLines = schedules.map(s =>
        `**${dayNames[s.dayOfWeek]}**: ${s.startTime} - ${s.endTime}`,
      ).join("\n")

      const shiftInfo = queue.scheduleShiftMinutes !== 0
        ? `\n${adminQueueCommands.schedule.summary.shiftInfo(queue.scheduleShiftMinutes)}`
        : ""

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(adminQueueCommands.schedule.summary.emptySchedule.title(name))
            .setDescription(adminQueueCommands.schedule.summary.populatedDescription(autoLockInfo, shiftInfo, scheduleLines))
            .setColor(Colors.Blue),
        ],
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "An error occurred."
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(adminQueueCommands.schedule.summary.errors.title)
            .setDescription(message)
            .setColor(Colors.Red),
        ],
      })
    }
  }
}
