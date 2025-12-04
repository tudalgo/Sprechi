import db, { guilds } from "@db"
import logger from "@utils/logger"
import { Guild } from "discord.js"
import { injectable } from "tsyringe"

@injectable()
export class GuildManager {
  async syncAllGuilds(): Promise<void> {
    // Import bot lazily to avoid circular dependency in tests
    const { bot } = await import("@/bot")
    const client = bot

    const existing = await db.select({ id: guilds.id }).from(guilds)
    const existingIds = new Set(existing.map(g => g.id))
    logger.info(`Bot is in ${existingIds.size} guilds. Checking database...`)

    const allGuilds = client.guilds.cache
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
