import { Discord, Slash, SlashOption, SlashGroup } from "discordx"
import { ApplicationCommandOptionType, CommandInteraction, EmbedBuilder, Colors } from "discord.js"
import { injectable, inject } from "tsyringe"
import { QueueManager } from "@managers/QueueManager"
import logger from "@utils/logger"

/**
 * Command to list users in a specific queue (Admin).
 */
@Discord()
@injectable()
@SlashGroup("queue", "admin")
export class AdminQueueList {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager,
  ) { }

  @Slash({ name: "list", description: "List users in a specific queue", dmPermission: false })
  async list(
    @SlashOption({
      description: "Name of the queue",
      name: "name",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    queueName: string,
    @SlashOption({
      description: "Max number of users to show (default: 5)",
      name: "max_entries",
      required: false,
      type: ApplicationCommandOptionType.Integer,
    })
    maxEntries: number | undefined,
    interaction: CommandInteraction,
  ) {
    if (!interaction.guild) return

    try {
      const limit = maxEntries ?? 5
      const embed = await this.queueManager.getQueueListEmbed(interaction.guild.id, queueName, limit)

      await interaction.reply({
        embeds: [embed],
      })
      logger.info(`Admin ${interaction.user.username} listed members for queue '${queueName}'`)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "An error occurred."
      logger.warn(`Failed to list queue members for admin ${interaction.user.username}: ${message}`)
      await interaction.reply({
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
