import {
  CommandInteraction,
  EmbedBuilder,
  Colors,
  MessageFlags,
  ApplicationCommandOptionType,
  User,
} from "discord.js"
import { Discord, Slash, SlashGroup, SlashOption } from "discordx"
import { QueueManager } from "@managers/QueueManager"
import { RoomManager } from "@managers/RoomManager"
import { QueueError } from "@errors/QueueErrors"
import logger from "@utils/logger"
import { inject, injectable } from "tsyringe"

@Discord()
@injectable()
@SlashGroup("queue", "tutor")
export class TutorQueuePick {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager,
    @inject(RoomManager) private roomManager: RoomManager
  ) { }

  @Slash({ name: "pick", description: "Pick a specific student from the queue" })
  async pick(
    @SlashOption({
      name: "user",
      description: "The user to pick",
      required: true,
      type: ApplicationCommandOptionType.User,
    })
    user: User,
    interaction: CommandInteraction
  ): Promise<void> {
    logger.info(`Command 'tutor queue pick' triggered by ${interaction.user.tag} (${interaction.user.id})`)

    if (!interaction.guild) return

    await interaction.deferReply({ flags: MessageFlags.Ephemeral })

    try {
      const activeSession = await this.queueManager.getActiveSession(interaction.guild.id, interaction.user.id)
      if (!activeSession) {
        throw new QueueError("You do not have an active session.")
      }

      const { queue, session } = activeSession

      // Check if user is in the queue
      const member = await this.queueManager.getQueueMember(queue.id, user.id)
      if (!member) {
        throw new QueueError(`<@${user.id}> is not in the queue '${queue.name}'.`)
      }

      const studentId = user.id
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
      logger.warn(`Failed to pick student ${user.id} for tutor ${interaction.user.tag}: ${message}`)
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
