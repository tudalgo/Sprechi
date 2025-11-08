import * as path from "path"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { Client, Discord, Once } from "discordx"
import { Events, Guild } from "discord.js"
import db, { guilds } from "../db"
import { eq } from "drizzle-orm"
import { exit } from "process"
import logger from "@utils/logger"

@Discord()
export class ReadyEvent {
  @Once({ event: Events.ClientReady })
  async onReady([client]: [Client]): Promise<void> {
    logger.info("The bot is ready!")
    const migrated = await this.migrateDb()
    if (migrated) {
      logger.info("Database migrated successfully.")
    } else {
      logger.info("Database migration failed.")
      exit(1)
    }
    await this.checkAndAddAllGuilds(client)
    logger.info(`Successfully checked and synced guilds for ${client.user!.tag}`)
  }

  private async migrateDb(): Promise<boolean> {
    try {
      const migrationsPath = path.resolve(
        "src/db/migrations",
      )
      logger.info(`Attempting to run migrations from: ${migrationsPath}`)
      await migrate(db, { migrationsFolder: migrationsPath })
      return true
    } catch (error) {
      logger.error(error)
      return false
    }
  }

  private async checkAndAddAllGuilds(client: Client): Promise<void> {
    const guildsCache = client.guilds.cache
    logger.info(`Bot is in ${guildsCache.size} guilds. Checking database...`)

    for (const [_, guild] of guildsCache) {
      await this.addGuildIfMissing(guild)
    }
  }

  private async addGuildIfMissing(guild: Guild): Promise<void> {
    const exists = await this.checkIfGuildExists(guild)
    if (!exists) {
      await this.addGuild(guild)
      logger.info(`[New Guild] Added ${guild.name} to the database.`)
    }
  }

  private async checkIfGuildExists(guild: Guild): Promise<boolean> {
    const result = await db
      .select({ id: guilds.id })
      .from(guilds)
      .where(eq(guilds.id, guild.id))
      .limit(1)
      .execute()

    return result.length > 0
  }

  private async addGuild(guild: Guild): Promise<void> {
    await db
      .insert(guilds)
      .values({
        id: guild.id,
        name: guild.name,
        memberCount: guild.memberCount,
      })
      .onConflictDoNothing()
      .execute()
  }
}
