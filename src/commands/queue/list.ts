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
import { queueCommands } from "@config/messages"

@Discord()
@injectable()
@SlashGroup({ name: "queue", description: queueCommands.list.groupDescription })
export class QueueList {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager,
  ) { }

  @Slash({ name: "list", description: queueCommands.list.description, dmPermission: false })
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
            .setTitle(queueCommands.list.emptyState.title)
            .setDescription(queueCommands.list.emptyState.description)
            .setColor(Colors.Yellow),
        ],
        flags: MessageFlags.Ephemeral,
      })
      return
    }

    const embed = new EmbedBuilder()
      .setTitle(queueCommands.list.listTitle)
      .setColor(Colors.Blue)
      .setDescription(
        queues
          .map(
            q =>
              queueCommands.list.queueEntry(q.name, q.isLocked, q.description, q.memberCount),
          )
          .join("\n\n"),
      )

    await interaction.reply({
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    })
  }
}
