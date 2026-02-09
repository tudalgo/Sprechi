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
import { adminSessionCommands } from "@config/messages"

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

@Discord()
@injectable()
@SlashGroup("session", "admin")
export class AdminSessionCleanupCommand {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager,
  ) { }

  @Slash({ name: "cleanup", description: adminSessionCommands.sessionCleanup.description, dmPermission: false })
  async cleanup(
    @SlashOption({
      name: "day",
      description: adminSessionCommands.sessionCleanup.optionDay,
      required: false,
      type: ApplicationCommandOptionType.String,
    })
    dayInput: string | undefined,
    @SlashOption({
      name: "time",
      description: adminSessionCommands.sessionCleanup.optionTime,
      required: false,
      type: ApplicationCommandOptionType.String,
    })
    time: string | undefined,
    @SlashOption({
      name: "disable",
      description: adminSessionCommands.sessionCleanup.optionDisable,
      required: false,
      type: ApplicationCommandOptionType.Boolean,
    })
    disable: boolean | undefined,
    interaction: CommandInteraction,
  ): Promise<void> {
    if (!interaction.guildId) return

    await interaction.deferReply({ flags: MessageFlags.Ephemeral })

    try {
      // Handle disable
      if (disable) {
        await this.queueManager.disableSessionCleanupSchedule(interaction.guildId)
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle(adminSessionCommands.sessionCleanup.disabled.title)
              .setDescription(adminSessionCommands.sessionCleanup.disabled.description)
              .setColor(Colors.Blue),
          ],
        })
        return
      }

      // If setting a schedule, both day and time are required
      if (!dayInput || !time) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle(adminSessionCommands.sessionCleanup.errors.title)
              .setDescription(adminSessionCommands.sessionCleanup.errors.missingArgs)
              .setColor(Colors.Red),
          ],
        })
        return
      }

      // Parse day
      const day = this.queueManager.parseDayOfWeek(dayInput)
      // Validate time format
      this.queueManager.validateTimeFormat(time)

      await this.queueManager.setSessionCleanupSchedule(interaction.guildId, day, time)

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(adminSessionCommands.sessionCleanup.success.title)
            .setDescription(adminSessionCommands.sessionCleanup.success.description(DAYS[day], time))
            .setColor(Colors.Green),
        ],
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : adminSessionCommands.sessionCleanup.errors.default
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(adminSessionCommands.sessionCleanup.errors.title)
            .setDescription(message)
            .setColor(Colors.Red),
        ],
      })
    }
  }
}
