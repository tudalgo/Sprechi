import {
  CommandInteraction,
  EmbedBuilder,
  Colors,
  MessageFlags,
} from "discord.js"
import { Discord, Slash, SlashGroup } from "discordx"
import { QueueManager } from "@managers/QueueManager"
import logger from "@utils/logger"
import { inject, injectable } from "tsyringe"

@Discord()
@injectable()
@SlashGroup({ name: "queue", description: "Queue commands" })
export class QueueList {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager,
  ) { }

  @Slash({ name: "list", description: "List all available queues", dmPermission: false })
  @SlashGroup("queue")
  async list(interaction: CommandInteraction): Promise<void> {
    if (!interaction.guild) return

    logger.info(`Command 'list queues' triggered by ${interaction.user.username} (${interaction.user.id})`)
    const queues = await this.queueManager.listQueues(interaction.guild.id)
    logger.info(`Listed ${queues.length} queues for guild '${interaction.guild.name}' (${interaction.guild.id})`)

    if (queues.length === 0) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("No Queues Found")
            .setDescription("There are no queues in this server.")
            .setColor(Colors.Yellow),
        ],
        flags: MessageFlags.Ephemeral,
      })
      return
    }

    const embed = new EmbedBuilder()
      .setTitle("Available Queues")
      .setColor(Colors.Blue)
      .setDescription(
        queues
          .map(
            q =>
              `**${q.name}** ${q.isLocked ? "🔒" : ""}\n${q.description}\nMembers: ${q.memberCount}`,
          )
          .join("\n\n"),
      )

    await interaction.reply({
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    })
  }
}
