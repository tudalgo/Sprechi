import { Discord, Slash, SlashOption, SlashGroup } from "discordx"
import { ApplicationCommandOptionType, CommandInteraction, EmbedBuilder, Colors, MessageFlags } from "discord.js"
import { injectable, inject } from "tsyringe"
import { QueueManager } from "@managers/QueueManager"
import logger from "@utils/logger"

/**
 * Command to show a summary of a specific queue (Admin).
 */
@Discord()
@injectable()
@SlashGroup("queue", "admin")
export class AdminQueueSummary {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager,
  ) { }

  @Slash({ name: "summary", description: "Show a summary of a specific queue", dmPermission: false })
  async summary(
    @SlashOption({
      description: "Name of the queue",
      name: "name",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    queueName: string,
    interaction: CommandInteraction,
  ) {
    if (!interaction.guild) return

    try {
      const embed = await this.queueManager.getQueueSummaryEmbed(interaction.guild.id, queueName)

      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      })
      logger.info(`Admin ${interaction.user.username} viewed summary for queue '${queueName}'`)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "An error occurred."
      logger.warn(`Failed to show queue summary for admin ${interaction.user.username}: ${message}`)
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Error")
            .setDescription(message)
            .setColor(Colors.Red),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }
  }
}
