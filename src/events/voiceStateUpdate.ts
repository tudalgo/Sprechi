import { ArgsOf, Discord, On } from "discordx"
import { QueueManager } from "@managers/QueueManager"
import logger from "@utils/logger"
import { AlreadyInQueueError, NotInQueueError } from "../errors/QueueErrors"
import db from "@db"
import { sessionStudents } from "@db/schema"
import { eq, and, isNull } from "drizzle-orm"

@Discord()
export class VoiceStateUpdate {
  private queueManager = new QueueManager()

  @On()
  async voiceStateUpdate([oldState, newState]: ArgsOf<"voiceStateUpdate">): Promise<void> {
    // User joined a channel
    if (!oldState.channelId && newState.channelId && newState.guild) {
      const channelId = newState.channelId
      const guildId = newState.guild.id
      const userId = newState.member?.id

      if (!userId) return

      try {
        const queue = await this.queueManager.getQueueByWaitingRoom(guildId, channelId)
        if (queue) {
          await this.queueManager.joinQueue(guildId, queue.name, userId)
        }
      } catch (error: unknown) {
        // If they are already in the queue, we can ignore it or log it
        if (!(error instanceof AlreadyInQueueError)) {
          logger.error(`Failed to auto-join queue for user ${userId}:`, error)
        }
      }
    }

    // User left a channel
    if (oldState.channelId && !newState.channelId && oldState.guild) {
      const channelId = oldState.channelId
      const guildId = oldState.guild.id
      const userId = oldState.member?.id

      if (!userId) return

      try {
        const queue = await this.queueManager.getQueueByWaitingRoom(guildId, channelId)
        if (queue) {
          // Silent leave (grace period starts, log only if they don't rejoin)
          await this.queueManager.leaveQueue(guildId, queue.name, userId, true)
        }

        // Check for ephemeral channel cleanup
        const [sessionStudent] = await db.select()
          .from(sessionStudents)
          .where(and(eq(sessionStudents.channelId, channelId), isNull(sessionStudents.endTime)))

        if (sessionStudent) {
          const channel = oldState.channel
          if (channel && channel.members.size === 0) {
            // Channel is empty, delete it and mark student session as ended
            try {
              await channel.delete()
              await db.update(sessionStudents)
                .set({ endTime: new Date() })
                .where(eq(sessionStudents.id, sessionStudent.id))
            } catch (err) {
              logger.error(`Failed to cleanup ephemeral channel ${channelId}:`, err)
            }
          }
        }
      } catch (error) {
        // Ignore errors if they weren't in queue
        if (!(error instanceof NotInQueueError)) {
          logger.error(`Failed to auto-leave queue for user ${userId}:`, error)
        }
      }
    }
  }
}
