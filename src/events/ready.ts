import { Client, Discord, On } from "discordx"
import { Events } from "discord.js"
import logger from "@utils/logger"
import { GuildManager } from "@managers/GuildManager"
import { inject, injectable } from "tsyringe"

@Discord()
@injectable()
export class ReadyEvent {
  constructor(
    @inject(GuildManager) private guildManager: GuildManager,
  ) { }

  @On({ event: Events.ClientReady })
  async onReady([client]: [Client]): Promise<void> {
    logger.info("The bot is ready!")
    await this.guildManager.syncAllGuilds()
    logger.info(`Successfully checked and synced guilds for ${client.user!.username}`)
  }
}
