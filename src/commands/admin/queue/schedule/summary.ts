import {
  ApplicationCommandOptionType,
  CommandInteraction,
  EmbedBuilder,
  Colors,
} from "discord.js"
import { Discord, Slash, SlashGroup, SlashOption } from "discordx"
import { QueueManager } from "@managers/QueueManager"
import { inject, injectable } from "tsyringe"

@Discord()
@injectable()
@SlashGroup("queue", "admin")
export class AdminQueueScheduleSummaryCommand {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager,
  ) { }

  @Slash({ name: "schedule-summary", description: "View all configured schedules for a queue", dmPermission: false })
  async summary(
    @SlashOption({
      name: "name",
      description: "The name of the queue",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    name: string,
    @SlashOption({
      name: "hide-private-info",
      description: "Hide private information",
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

      const autoLockInfo = hidePrivateInfo ? "" : `**Auto-Lock:** ${queue.scheduleEnabled ? "✅ Enabled" : "❌ Disabled"}`

      if (schedules.length === 0) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle(`Schedule Summary: ${name}`)
              .setDescription(`${autoLockInfo}\n\nNo schedules configured for this queue.`)
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
        ? `\n**Time Shift:** ${queue.scheduleShiftMinutes > 0 ? "-" : "+"}${queue.scheduleShiftMinutes} minutes`
        : ""

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`Schedule Summary: ${name}`)
            .setDescription(`${autoLockInfo}${shiftInfo}\n\n${scheduleLines}`)
            .setColor(Colors.Blue),
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
