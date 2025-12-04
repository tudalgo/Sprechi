import { ButtonInteraction, EmbedBuilder, Colors, MessageFlags } from "discord.js"
import { Discord, ButtonComponent } from "discordx"
import { QueueManager } from "@managers/QueueManager"
import logger from "@utils/logger"
import { NotInQueueError } from "../errors/QueueErrors"
import { inject, injectable } from "tsyringe"

@Discord()
@injectable()
export class QueueButtons {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager
  ) { }

  @ButtonComponent({ id: /^queue_refresh_(.+)$/ })
  async refresh(interaction: ButtonInteraction): Promise<void> {
    const queueId = interaction.customId.match(/^queue_refresh_(.+)$/)?.[1]
    if (!queueId) return

    logger.info(`Button 'queue_refresh' clicked by ${interaction.user.tag} (${interaction.user.id}) for queueId '${queueId}'`)

    await interaction.deferUpdate()

    try {
      // Fetch queue to get details
      const queue = await this.queueManager.getQueueById(queueId)

      if (!queue) {
        await interaction.followUp({
          content: "Queue not found.",
          flags: MessageFlags.Ephemeral,
        })
        return
      }

      const member = await this.queueManager.getQueueMember(queue.id, interaction.user.id)
      if (!member) {
        await interaction.followUp({
          content: "You are not in this queue anymore.",
          flags: MessageFlags.Ephemeral,
        })
        return
      }

      const position = await this.queueManager.getQueuePosition(queue.id, interaction.user.id)

      const embed = new EmbedBuilder()
        .setTitle(`Joined Queue: ${queue.name}`)
        .setDescription(`You have joined the queue **${queue.name}**.\n\n**Position:** ${position}\n**Joined:** <t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>`)
        .setColor(Colors.Green)
        .setTimestamp()

      await interaction.editReply({ embeds: [embed] })
    } catch (error) {
      logger.warn(`Error refreshing queue status for user ${interaction.user.tag}: `, error)
    }
  }

  @ButtonComponent({ id: /^queue_leave_(.+)$/ })
  async leave(interaction: ButtonInteraction): Promise<void> {
    const queueId = interaction.customId.match(/^queue_leave_(.+)$/)?.[1]
    if (!queueId) return

    logger.info(`Button 'queue_leave' clicked by ${interaction.user.tag} (${interaction.user.id}) for queueId '${queueId}'`)

    await interaction.deferUpdate()

    try {
      const queue = await this.queueManager.getQueueById(queueId)
      if (!queue) {
        await interaction.followUp({
          content: "Queue not found.",
          flags: MessageFlags.Ephemeral,
        })
        return
      }

      // Use queue.guildId because interaction.guildId is null in DMs
      await this.queueManager.leaveQueue(queue.guildId, queue.name, interaction.user.id)

      const embed = new EmbedBuilder()
        .setTitle("Left Queue")
        .setDescription(`You have left the queue **${queue.name}**.`)
        .setColor(Colors.Yellow)
        .setTimestamp()

      await interaction.editReply({
        content: "",
        embeds: [embed],
        components: []
      })
    } catch (error) {
      if (error instanceof NotInQueueError) {
        await interaction.followUp({
          content: "You are not in the queue.",
          flags: MessageFlags.Ephemeral,
        })
      } else {
        logger.error(`Error handling queue leave button for user ${interaction.user.tag}: `, error)
      }
    }
  }

  @ButtonComponent({ id: /^queue_rejoin_(.+)$/ })
  async rejoin(interaction: ButtonInteraction): Promise<void> {
    const queueId = interaction.customId.match(/^queue_rejoin_(.+)$/)?.[1]
    if (!queueId) return

    logger.info(`Button 'queue_rejoin' clicked by ${interaction.user.tag} (${interaction.user.id}) for queueId '${queueId}'`)

    await interaction.deferUpdate()

    try {
      const queue = await this.queueManager.getQueueById(queueId)
      if (!queue) {
        await interaction.followUp({
          content: "Queue not found.",
          flags: MessageFlags.Ephemeral,
        })
        return
      }

      // Use queue.guildId because interaction.guildId is null in DMs
      await this.queueManager.joinQueue(queue.guildId, queue.name, interaction.user.id)

      const embed = new EmbedBuilder()
        .setTitle("Rejoined Queue")
        .setDescription(`You have rejoined the queue **${queue.name}**.`)
        .setColor(Colors.Green)
        .setTimestamp()

      await interaction.editReply({
        content: "",
        embeds: [embed],
        components: []
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to rejoin queue."
      logger.warn(`Error handling queue rejoin button for user ${interaction.user.tag}: ${message}`)
      await interaction.followUp({
        content: message,
        flags: MessageFlags.Ephemeral,
      })
    }
  }
}
