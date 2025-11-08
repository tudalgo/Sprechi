import db from "@db"
import { queues } from "@db/schema"
import logger from "@utils/logger"
import { eq, and } from "drizzle-orm"

export interface QueueData {
  guildId: string
  name: string
  description: string
}

export class QueueManager {
  async createQueue(data: QueueData) {
    const [newQueue] = await db.insert(queues)
      .values({
        guildId: data.guildId,
        name: data.name,
        description: data.description,
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
    return db.select()
      .from(queues)
      .where(eq(queues.guildId, guildId))
  }

  async deleteQueue(guildId: string, name: string) {
    const deleted = await db.delete(queues)
      .where(and(eq(queues.guildId, guildId), eq(queues.name, name)))
      .returning()
    return deleted.length > 0
  }
}
