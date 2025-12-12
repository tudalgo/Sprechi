import { ButtonInteraction, EmbedBuilder, Colors, MessageFlags } from "discord.js"
import { Discord, ButtonComponent } from "discordx"
import { QueueManager } from "@managers/QueueManager"
import logger from "@utils/logger"
import { NotInQueueError, TutorCannotJoinQueueError } from "../errors/QueueErrors"
import { inject, injectable } from "tsyringe"
import { events } from "@config/messages"

@Discord()
@injectable()
export class QueueButtons {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager,
  ) { }

  @ButtonComponent({ id: /^queue_refresh_(.+)$/ })
  async refresh(interaction: ButtonInteraction): Promise<void> {
    const queueId = interaction.customId.match(/^queue_refresh_(.+)$/)?.[1]
    if (!queueId) return

    logger.info(`Button 'queue_refresh' clicked by ${interaction.user.username} (${interaction.user.id}) for queueId '${queueId}'`)

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
          content: events.queueButtons.errors.notInQueueAnymore,
          flags: MessageFlags.Ephemeral,
        })
        return
      }

      const position = await this.queueManager.getQueuePosition(queue.id, interaction.user.id)

      const embed = new EmbedBuilder()
        .setTitle(events.queueButtons.joinedQueue.title(queue.name))
        .setDescription(events.queueButtons.joinedQueue.description(queue.name, position, Math.floor(member.joinedAt.getTime() / 1000)))
        .setColor(Colors.Green)
        .setTimestamp()

      await interaction.editReply({ embeds: [embed] })
    } catch (error) {
      logger.warn(`Error refreshing queue status for user ${interaction.user.username}: `, error)
    }
  }

  @ButtonComponent({ id: /^queue_leave_(.+)$/ })
  async leave(interaction: ButtonInteraction): Promise<void> {
    const queueId = interaction.customId.match(/^queue_leave_(.+)$/)?.[1]
    if (!queueId) return

    logger.info(`Button 'queue_leave' clicked by ${interaction.user.username} (${interaction.user.id}) for queueId '${queueId}'`)

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
        .setTitle(events.queueButtons.leftQueue.title)
        .setDescription(events.queueButtons.leftQueue.description(queue.name))
        .setColor(Colors.Yellow)
        .setTimestamp()

      await interaction.editReply({
        content: "",
        embeds: [embed],
        components: [],
      })
    } catch (error) {
      if (error instanceof NotInQueueError) {
        await interaction.followUp({
          content: events.queueButtons.errors.notInQueue,
          flags: MessageFlags.Ephemeral,
        })
      } else {
        logger.error(`Error handling queue leave button for user ${interaction.user.username}: `, error)
      }
    }
  }

  @ButtonComponent({ id: /^queue_rejoin_(.+)$/ })
  async rejoin(interaction: ButtonInteraction): Promise<void> {
    const queueId = interaction.customId.match(/^queue_rejoin_(.+)$/)?.[1]
    if (!queueId) return

    logger.info(`Button 'queue_rejoin' clicked by ${interaction.user.username} (${interaction.user.id}) for queueId '${queueId}'`)

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
        .setTitle(events.queueButtons.rejoinedQueue.title)
        .setDescription(events.queueButtons.rejoinedQueue.description(queue.name))
        .setColor(Colors.Green)
        .setTimestamp()

      await interaction.editReply({
        content: "",
        embeds: [embed],
        components: [],
      })
    } catch (error) {
      let message = events.queueButtons.errors.failedToRejoin
      if (error instanceof TutorCannotJoinQueueError) {
        message = events.queueButtons.errors.tutorSessionConflict
      } else if (error instanceof Error) {
        message = error.message
      }
      logger.warn(`Error handling queue rejoin button for user ${interaction.user.username}: ${message}`)
      await interaction.followUp({
        embeds: [
          new EmbedBuilder()
            .setTitle(events.queueButtons.errors.title)
            .setDescription(message)
            .setColor(Colors.Red),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }
  }
}
