import db from "@db"
import { queues, queueMembers, sessions, sessionStudents } from "@db/schema"
import logger from "@utils/logger"
import { eq, and, sql, isNull } from "drizzle-orm"
import {
  QueueNotFoundError,
  QueueLockedError,
  AlreadyInQueueError,
  NotInQueueError,
  SessionAlreadyActiveError,
  QueueError,
} from "../errors/QueueErrors"

export interface QueueData {
  guildId: string
  name: string
  description: string
}

export class QueueManager {
  async createQueue(data: QueueData & { isLocked?: boolean }) {
    const [newQueue] = await db.insert(queues)
      .values({
        guildId: data.guildId,
        name: data.name,
        description: data.description,
        isLocked: data.isLocked ?? false,
      })
      .returning()
    logger.info(`[New Queue] Created queue "${data.name}" in guild ${data.guildId}.`)
    return newQueue
  }

  async getQueueByName(guildId: string, name: string) {
    const [queue] = await db.select()
      .from(queues)
      .where(and(eq(queues.guildId, guildId), eq(queues.name, name)))
    return queue ?? null
  }

  async listQueues(guildId: string) {
    const result = await db.select({
      queue: queues,
      memberCount: sql<number>`count(${queueMembers.id}) filter (where ${queueMembers.leftAt} is null)`,
      sessionCount: sql<number>`count(${sessions.id}) filter (where ${sessions.endTime} is null)`,
    })
      .from(queues)
      .leftJoin(queueMembers, eq(queues.id, queueMembers.queueId))
      .leftJoin(sessions, eq(queues.id, sessions.queueId))
      .where(eq(queues.guildId, guildId))
      .groupBy(queues.id)

    return result.map(({ queue, memberCount, sessionCount }) => ({
      ...queue,
      memberCount: Number(memberCount),
      sessionCount: Number(sessionCount),
    }))
  }

  async deleteQueue(guildId: string, name: string) {
    const deleted = await db.delete(queues)
      .where(and(eq(queues.guildId, guildId), eq(queues.name, name)))
      .returning()
    return deleted.length > 0
  }

  async joinQueue(guildId: string, queueName: string, userId: string) {
    const queue = await this.getQueueByName(guildId, queueName)
    if (!queue) {
      throw new QueueNotFoundError(queueName)
    }

    if (queue.isLocked) {
      throw new QueueLockedError(queueName)
    }

    // Check if user is already in queue
    const [existingMember] = await db.select()
      .from(queueMembers)
      .where(and(eq(queueMembers.queueId, queue.id), eq(queueMembers.userId, userId)))

    if (existingMember) {
      if (!existingMember.leftAt) {
        throw new AlreadyInQueueError(queueName)
      }

      // Rejoin logic
      const leftAt = new Date(existingMember.leftAt)
      const now = new Date()
      const diff = now.getTime() - leftAt.getTime()

      if (diff < 60000) {
        // Within grace period, restore position
        await db.update(queueMembers)
          .set({ leftAt: null })
          .where(eq(queueMembers.id, existingMember.id))

        await this.logToChannel(queue, `User <@${userId}> rejoined the queue (restored position).`)
        return
      } else {
        // Grace period expired, treat as new join
        await db.delete(queueMembers).where(eq(queueMembers.id, existingMember.id))
      }
    }

    await db.insert(queueMembers).values({
      queueId: queue.id,
      userId,
    })

    await this.logToChannel(queue, `User <@${userId}> joined the queue.`)
  }

  async leaveQueue(guildId: string, queueName: string, userId: string, silent: boolean = false) {
    const queue = await this.getQueueByName(guildId, queueName)
    if (!queue) {
      throw new QueueNotFoundError(queueName)
    }

    const [member] = await db.select()
      .from(queueMembers)
      .where(and(eq(queueMembers.queueId, queue.id), eq(queueMembers.userId, userId), isNull(queueMembers.leftAt)))

    if (!member) {
      throw new NotInQueueError(queueName)
    }

    await db.update(queueMembers)
      .set({ leftAt: new Date() })
      .where(eq(queueMembers.id, member.id))

    if (!silent) {
      await this.logToChannel(queue, `User <@${userId}> left the queue (grace period started).`)
    }

    // Schedule cleanup
    setTimeout(async () => {
      try {
        const [currentMember] = await db.select()
          .from(queueMembers)
          .where(eq(queueMembers.id, member.id))

        if (currentMember && currentMember.leftAt) {
          const diff = new Date().getTime() - new Date(currentMember.leftAt).getTime()
          if (diff >= 60000) {
            await db.delete(queueMembers).where(eq(queueMembers.id, member.id))

            // Log removal if silent was true (meaning they left the channel)
            if (silent) {
              await this.logToChannel(queue, `User <@${userId}> left the queue.`)
            }
          }
        }
      } catch (error) {
        logger.error("Error in queue leave cleanup:", error)
      }
    }, 60000)
  }

  async getActiveSession(guildId: string, tutorId: string) {
    const [session] = await db.select({
      session: sessions,
      queue: queues,
    })
      .from(sessions)
      .innerJoin(queues, eq(sessions.queueId, queues.id))
      .where(and(
        eq(queues.guildId, guildId),
        eq(sessions.tutorId, tutorId),
        isNull(sessions.endTime)
      ))

    return session ?? null
  }

  async pickStudent(guildId: string, queueName: string, userId: string, sessionId: string, tutorId: string, channelId: string, channelName: string) {
    const queue = await this.getQueueByName(guildId, queueName)
    if (!queue) {
      throw new QueueNotFoundError(queueName)
    }

    // Remove from queue immediately (no grace period)
    await db.delete(queueMembers)
      .where(and(eq(queueMembers.queueId, queue.id), eq(queueMembers.userId, userId)))

    // Create session student record
    await db.insert(sessionStudents).values({
      sessionId,
      studentId: userId,
      channelId,
    })

    await this.logToChannel(queue, `User <@${userId}> was picked by <@${tutorId}>.`)

    // DM Student
    try {
      const { bot } = await import("../bot")
      const { EmbedBuilder, Colors } = await import("discord.js")
      const inviteLink = `https://discord.com/channels/${guildId}/${channelId}`

      const user = await bot.users.fetch(userId)
      await user.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("You have been picked!")
            .setDescription(`You have been picked by <@${tutorId}> for a tutoring session.\nPlease join the voice channel: [${channelName}](${inviteLink})`)
            .setColor(Colors.Green)
        ]
      })
    } catch (error) {
      logger.error(`Failed to DM user ${userId} after being picked:`, error)
    }
  }

  async toggleLock(guildId: string, queueName: string, lock: boolean) {
    const result = await db.update(queues)
      .set({ isLocked: lock })
      .where(and(eq(queues.guildId, guildId), eq(queues.name, queueName)))
      .returning()

    if (result.length === 0) {
      throw new QueueNotFoundError(queueName)
    }
  }

  async getQueueMembers(guildId: string, queueName: string) {
    const queue = await this.getQueueByName(guildId, queueName)
    if (!queue) return []

    return db.select()
      .from(queueMembers)
      .where(and(eq(queueMembers.queueId, queue.id), isNull(queueMembers.leftAt)))
      .orderBy(queueMembers.joinedAt)
  }

  async setWaitingRoom(guildId: string, queueName: string, channelId: string) {
    const result = await db.update(queues)
      .set({ waitingRoomId: channelId })
      .where(and(eq(queues.guildId, guildId), eq(queues.name, queueName)))
      .returning()

    if (result.length === 0) {
      throw new QueueNotFoundError(queueName)
    }
  }

  async setLogChannel(guildId: string, queueName: string, channelId: string) {
    const result = await db.update(queues)
      .set({ logChannelId: channelId })
      .where(and(eq(queues.guildId, guildId), eq(queues.name, queueName)))
      .returning()

    if (result.length === 0) {
      throw new QueueNotFoundError(queueName)
    }
  }

  async createSession(guildId: string, queueName: string, tutorId: string) {
    const queue = await this.getQueueByName(guildId, queueName)
    if (!queue) {
      throw new QueueNotFoundError(queueName)
    }

    // Check if tutor already has an active session in this guild
    const [activeSession] = await db.select()
      .from(sessions)
      .innerJoin(queues, eq(sessions.queueId, queues.id))
      .where(and(
        eq(queues.guildId, guildId),
        eq(sessions.tutorId, tutorId),
        isNull(sessions.endTime)
      ))

    if (activeSession) {
      throw new SessionAlreadyActiveError()
    }

    await db.insert(sessions).values({
      queueId: queue.id,
      tutorId,
    })

    await this.logToChannel(queue, `Tutor <@${tutorId}> started a session.`)
  }

  async endSession(guildId: string, tutorId: string) {
    const activeSession = await this.getActiveSession(guildId, tutorId)
    if (!activeSession) {
      throw new QueueError("You do not have an active session.")
    }

    const { session, queue } = activeSession

    const result = await db.update(sessions)
      .set({ endTime: new Date() })
      .where(eq(sessions.id, session.id))
      .returning()

    if (result.length > 0) {
      await this.logToChannel(queue, `Tutor <@${tutorId}> ended their session.`)
    }
  }

  async resolveQueue(guildId: string, queueName?: string) {
    if (queueName) {
      const queue = await this.getQueueByName(guildId, queueName)
      if (!queue) throw new QueueNotFoundError(queueName)
      return queue
    }

    const allQueues = await this.listQueues(guildId)
    if (allQueues.length === 0) {
      throw new QueueError("No queues found in this server.")
    }
    if (allQueues.length === 1) {
      return allQueues[0]
    }
    throw new QueueError("Multiple queues found. Please specify a queue name.")
  }

  async getQueueByUser(guildId: string, userId: string) {
    const [member] = await db.select({
      queue: queues,
    })
      .from(queueMembers)
      .innerJoin(queues, eq(queueMembers.queueId, queues.id))
      .where(and(
        eq(queues.guildId, guildId),
        eq(queueMembers.userId, userId),
        isNull(queueMembers.leftAt)
      ))

    return member?.queue ?? null
  }

  async getQueueByWaitingRoom(guildId: string, channelId: string) {
    const [queue] = await db.select()
      .from(queues)
      .where(and(eq(queues.guildId, guildId), eq(queues.waitingRoomId, channelId)))
    return queue ?? null
  }

  private async logToChannel(queue: typeof queues.$inferSelect, message: string) {
    if (!queue.logChannelId) return

    try {
      const { bot } = await import("../bot")
      const channel = await bot.channels.fetch(queue.logChannelId)
      const { EmbedBuilder, Colors, ChannelType } = await import("discord.js")

      if (channel && channel.type === ChannelType.GuildText) {
        // Get stats
        const [memberCount] = await db.select({ count: sql<number>`count(*)` })
          .from(queueMembers)
          .where(and(eq(queueMembers.queueId, queue.id), isNull(queueMembers.leftAt)))

        const [sessionCount] = await db.select({ count: sql<number>`count(*)` })
          .from(sessions)
          .where(and(eq(sessions.queueId, queue.id), isNull(sessions.endTime)))

        const embed = new EmbedBuilder()
          .setTitle(`Queue Update: ${queue.name}`)
          .setDescription(message)
          .addFields(
            { name: "Members in Queue", value: String(memberCount?.count ?? 0), inline: true },
            { name: "Active Sessions", value: String(sessionCount?.count ?? 0), inline: true }
          )
          .setColor(Colors.Blue)
          .setTimestamp()

        await channel.send({ embeds: [embed] })
      }
    } catch (error) {
      logger.error(`Failed to log to channel ${queue.logChannelId}:`, error)
    }
  }
}
