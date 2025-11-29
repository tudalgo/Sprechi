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

@Discord()
@SlashGroup({ name: "tutor", description: "Tutor commands" })
@SlashGroup({ name: "queue", description: "Queue management", root: "tutor" })
export class TutorQueueNext {
  private queueManager = new QueueManager()
  private roomManager = new RoomManager()

  @Slash({ name: "next", description: "Pick the next student from the queue" })
  @SlashGroup("queue", "tutor")
  async next(interaction: CommandInteraction): Promise<void> {
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
        await interaction.editReply("The queue is empty.")
        return
      }

      const nextMember = members[0]
      const studentId = nextMember.userId
      const tutorId = interaction.user.id

      // Get waiting room category
      let categoryId: string | undefined
      if (queue.waitingRoomId) {
        try {
          const waitingChannel = await interaction.guild.channels.fetch(queue.waitingRoomId)
          if (waitingChannel && waitingChannel.parentId) {
            categoryId = waitingChannel.parentId
          }
        } catch (error) {
          // Ignore if waiting room not found
        }
      }

      // Create ephemeral channel
      const channelName = `Session-${interaction.user.username}`
      const channel = await this.roomManager.createEphemeralChannel(
        interaction.guild,
        channelName,
        [tutorId, studentId],
        categoryId,
      )

      if (!channel) {
        throw new QueueError("Failed to create session room.")
      }

      // Move tutor
      const tutorMember = await interaction.guild.members.fetch(tutorId)
      if (tutorMember.voice.channel) {
        await tutorMember.voice.setChannel(channel)
      }

      // Use pickStudent to remove from queue, record session student, log, and DM
      await this.queueManager.pickStudent(
        interaction.guild.id,
        queue.name,
        studentId,
        session.id,
        tutorId,
        channel.id,
      )

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Student Picked")
            .setDescription(`Picked <@${studentId}>. Created room <#${channel.id}>.`)
            .setColor(Colors.Green),
        ],
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "An error occurred."
      await interaction.editReply(message)
    }
  }
}
