import db, { guilds } from "@db"
import logger from "@utils/logger"
import { Client, Guild } from "discord.js"

export class GuildManager {
  public constructor(private client?: Client) { }

  async syncAllGuilds(): Promise<void> {
    if (!this.client) {
      throw new Error("Client not initialized in GuildManager.")
    }

    const existing = await db.select({ id: guilds.id }).from(guilds)
    const existingIds = new Set(existing.map(g => g.id))
    logger.info(`Bot is in ${existingIds.size} guilds. Checking database...`)

    const allGuilds = this.client.guilds.cache
    for (const [id, guild] of allGuilds) {
      if (!existingIds.has(id)) {
        await this.addGuild(guild)
      }
    }
    logger.info("Guild sync complete.")
  }

  async addGuild(guild: Guild): Promise<void> {
    await db.insert(guilds).values({
      id: guild.id,
      name: guild.name,
      memberCount: guild.memberCount,
    }).onConflictDoNothing()
    logger.info(`[New Guild] Added ${guild.name} (${guild.id}) to the database.`)
  }
}
