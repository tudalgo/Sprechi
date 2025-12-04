import {
  CommandInteraction,
  EmbedBuilder,
  Colors,
  MessageFlags,
} from "discord.js"
import { Discord, Slash, SlashGroup } from "discordx"
import { QueueManager } from "@managers/QueueManager"
import { RoomManager } from "@managers/RoomManager"
import { QueueError } from "@errors/QueueErrors"
import logger from "@utils/logger"
import { inject, injectable } from "tsyringe"

@Discord()
@injectable()
@SlashGroup({ name: "tutor", description: "Tutor commands" })
@SlashGroup({ name: "queue", description: "Queue management", root: "tutor" })
export class TutorQueueNext {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager,
    @inject(RoomManager) private roomManager: RoomManager
  ) { }

  @Slash({ name: "next", description: "Pick the next student from the queue" })
  @SlashGroup("queue", "tutor")
  async next(interaction: CommandInteraction): Promise<void> {
    logger.info(`Command 'tutor queue next' triggered by ${interaction.user.tag} (${interaction.user.id})`)

    if (!interaction.guild) return

    await interaction.deferReply({ flags: MessageFlags.Ephemeral })

    try {
      const activeSession = await this.queueManager.getActiveSession(interaction.guild.id, interaction.user.id)
      if (!activeSession) {
        throw new QueueError("You do not have an active session.")
      }

      const { queue, session } = activeSession
      const members = await this.queueManager.getQueueMembers(interaction.guild.id, queue.name)

      if (members.length === 0) {
        const embed = new EmbedBuilder()
          .setTitle(`Queue: ${queue.name}`)
          .setDescription("The queue is empty.")
          .setColor(Colors.Blue)

        await interaction.editReply({ embeds: [embed] })
        return
      }

      const nextMember = members[0]
      const studentId = nextMember.userId
      const tutorId = interaction.user.id

      await this.queueManager.processStudentPick(
        interaction,
        this.roomManager,
        queue,
        session,
        studentId,
        tutorId
      )
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "An error occurred."
      logger.warn(`Failed to pick next student for tutor ${interaction.user.tag}: ${message} `)
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
