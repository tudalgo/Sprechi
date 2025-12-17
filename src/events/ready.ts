import { Client, Discord, On } from "discordx"
import { Events } from "discord.js"
import logger from "@utils/logger"
import { GuildManager } from "@managers/GuildManager"
import { QueueManager } from "@managers/QueueManager"
import { inject, injectable } from "tsyringe"

@Discord()
@injectable()
export class ReadyEvent {
  constructor(
    @inject(GuildManager) private guildManager: GuildManager,
    @inject(QueueManager) private queueManager: QueueManager,
  ) { }

  @On({ event: Events.ClientReady })
  async onReady([client]: [Client]): Promise<void> {
    logger.info("The bot is ready!")
    await this.guildManager.syncAllGuilds()
    logger.info(`Successfully checked and synced guilds for ${client.user!.username}`)

    // Start schedule checker (every minute)
    setInterval(() => {
      this.queueManager.checkSchedules().catch((err) => {
        logger.error("Error in schedule checker:", err)
      })
    }, 60000)

    // Initial check
    this.queueManager.checkSchedules().catch((err) => {
      logger.error("Error in initial schedule check:", err)
    })
  }
}
