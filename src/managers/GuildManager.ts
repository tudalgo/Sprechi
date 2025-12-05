import db, { guilds, roleMappings, InternalRole } from "@db"
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

  async setRole(guildId: string, type: InternalRole, roleId: string): Promise<void> {
    await db.insert(roleMappings).values({
      guildId,
      roleType: type,
      roleId,
    }).onConflictDoUpdate({
      target: [roleMappings.guildId, roleMappings.roleType],
      set: { roleId, updatedAt: new Date() },
    })
    logger.info(`[GuildManager] Set role ${type} for guild ${guildId} to ${roleId}`)
  }

  async getRole(guildId: string, type: InternalRole): Promise<string | null> {
    const mapping = await db.query.roleMappings.findFirst({
      where: (table, { eq, and }) => and(eq(table.guildId, guildId), eq(table.roleType, type)),
    })
    return mapping?.roleId ?? null
  }

  async getAllRoles(guildId: string): Promise<{ type: InternalRole, roleId: string }[]> {
    const mappings = await db.query.roleMappings.findMany({
      where: (table, { eq }) => eq(table.guildId, guildId),
    })
    return mappings.map(m => ({ type: m.roleType as InternalRole, roleId: m.roleId }))
  }
}
