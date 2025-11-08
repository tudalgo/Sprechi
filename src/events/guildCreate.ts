import { Discord, On } from "discordx"
import { Guild } from "discord.js"
import logger from "@utils/logger"
import { GuildManager } from "@managers/GuildManager"

@Discord()
export class GuildCreateEvent {
  @On({ event: "guildCreate" })
  async onGuildJoin([guild]: [Guild]) {
    logger.info(`Joined new guild: ${guild.name}`)
    const guildManager = new GuildManager()
    await guildManager.addGuild(guild)
  }
}
