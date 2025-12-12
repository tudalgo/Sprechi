import { ArgsOf, Discord, On } from "discordx"
import { QueueManager } from "@managers/QueueManager"
import { DmManager } from "@managers/DmManager"
import logger from "@utils/logger"
import { AlreadyInQueueError, NotInQueueError, TutorCannotJoinQueueError, QueueLockedError } from "../errors/QueueErrors"
import { EmbedBuilder, Colors } from "discord.js"
import db from "@db"
import { sessionStudents } from "@db/schema"
import { eq, and, isNull } from "drizzle-orm"
import { events } from "@config/messages"

import { injectable, inject } from "tsyringe"

@Discord()
@injectable()
export class VoiceStateUpdate {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager,
    @inject(DmManager) private dmManager: DmManager,
  ) { }

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
          logger.info(`User ${newState.member?.user.username} (${userId}) auto-joined queue '${queue.name}' by entering waiting room`)
        }
      } catch (error: unknown) {
        // Handle QueueLockedError specially: disconnect user and send DM
        if (error instanceof QueueLockedError) {
          try {
            // Disconnect user from voice channel
            await newState.disconnect()
            logger.info(`Disconnected user ${newState.member?.user.username} (${userId}) from locked queue waiting room`)

            // Send DM to user with embed
            const embed = new EmbedBuilder()
              .setTitle(events.voiceStateUpdate.queueLocked.title)
              .setDescription(events.voiceStateUpdate.queueLocked.description)
              .setColor(Colors.Red)

            await this.dmManager.sendDm(
              newState.client,
              userId,
              embed,
            )
          } catch (dmError) {
            logger.warn(`Failed to disconnect or DM user ${userId} for locked queue:`, dmError)
          }
        } else if (!(error instanceof AlreadyInQueueError) && !(error instanceof TutorCannotJoinQueueError)) {
          // If they are already in the queue or are a tutor with an active session, we can ignore it or log it
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
          await this.queueManager.leaveQueue(guildId, queue.name, userId)
          logger.info(`User ${oldState.member?.user.username} (${userId}) left waiting room of queue '${queue.name}' (grace period started)`)
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
              logger.info(`Deleted empty ephemeral channel '${channel.name}' (${channel.id})`)
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
