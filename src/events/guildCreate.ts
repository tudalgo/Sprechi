import { Discord, On } from "discordx"
import { Guild } from "discord.js"
import logger from "@utils/logger"
import { GuildManager } from "@managers/GuildManager"
import { inject, injectable } from "tsyringe"

@Discord()
@injectable()
export class GuildCreateEvent {
  constructor(
    @inject(GuildManager) private guildManager: GuildManager,
  ) { }

  @On({ event: "guildCreate" })
  async onGuildJoin([guild]: [Guild]) {
    logger.info(`Joined new guild: ${guild.name} (${guild.id})`)
    await this.guildManager.addGuild(guild)
    logger.info(`Initialized guild settings for ${guild.name} (${guild.id})`)
  }
}
