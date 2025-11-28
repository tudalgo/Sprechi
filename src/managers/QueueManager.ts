import db from "@db"
import { queues, queueMembers } from "@db/schema"
import logger from "@utils/logger"
import { eq, and, sql, isNull } from "drizzle-orm"

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
    })
      .from(queues)
      .leftJoin(queueMembers, eq(queues.id, queueMembers.queueId))
      .where(eq(queues.guildId, guildId))
      .groupBy(queues.id)

    return result.map(({ queue, memberCount }) => ({
      ...queue,
      memberCount: Number(memberCount),
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
      throw new Error("Queue not found")
    }

    if (queue.isLocked) {
      throw new Error("Queue is locked")
    }

    // Check if user is already in queue
    const [existingMember] = await db.select()
      .from(queueMembers)
      .where(and(eq(queueMembers.queueId, queue.id), eq(queueMembers.userId, userId)))

    if (existingMember) {
      if (!existingMember.leftAt) {
        throw new Error("Already in queue")
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
        return
      } else {
        // Grace period expired, treat as new join (delete old, insert new to reset joinedAt)
        await db.delete(queueMembers).where(eq(queueMembers.id, existingMember.id))
      }
    }

    await db.insert(queueMembers).values({
      queueId: queue.id,
      userId,
    })
  }

  async leaveQueue(guildId: string, queueName: string, userId: string) {
    const queue = await this.getQueueByName(guildId, queueName)
    if (!queue) {
      throw new Error("Queue not found")
    }

    await db.update(queueMembers)
      .set({ leftAt: new Date() })
      .where(and(eq(queueMembers.queueId, queue.id), eq(queueMembers.userId, userId), isNull(queueMembers.leftAt)))

    // Schedule cleanup
    setTimeout(async () => {
      try {
        const [member] = await db.select()
          .from(queueMembers)
          .where(and(eq(queueMembers.queueId, queue.id), eq(queueMembers.userId, userId)))

        if (member && member.leftAt) {
          const diff = new Date().getTime() - new Date(member.leftAt).getTime()
          if (diff >= 60000) {
            await db.delete(queueMembers).where(eq(queueMembers.id, member.id))
          }
        }
      } catch (error) {
        logger.error("Error in queue leave cleanup:", error)
      }
    }, 60000)
  }

  async toggleLock(guildId: string, queueName: string, lock: boolean) {
    const result = await db.update(queues)
      .set({ isLocked: lock })
      .where(and(eq(queues.guildId, guildId), eq(queues.name, queueName)))
      .returning()

    if (result.length === 0) {
      throw new Error("Queue not found")
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
}
