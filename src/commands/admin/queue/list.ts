import { Discord, Slash, SlashOption, SlashGroup } from "discordx"
import { ApplicationCommandOptionType, CommandInteraction, EmbedBuilder, Colors } from "discord.js"
import { injectable, inject } from "tsyringe"
import { QueueManager } from "@managers/QueueManager"
import logger from "@utils/logger"
import { adminQueueCommands } from "@config/messages"

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

  @Slash({ name: "list", description: adminQueueCommands.list.description, dmPermission: false })
  async list(
    @SlashOption({
      description: adminQueueCommands.list.optionName,
      name: "name",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    queueName: string,
    @SlashOption({
      description: adminQueueCommands.list.optionMaxEntries,
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
            .setTitle(adminQueueCommands.list.errors.title)
            .setDescription(message)
            .setColor(Colors.Red),
        ],
      })
    }
  }
}
