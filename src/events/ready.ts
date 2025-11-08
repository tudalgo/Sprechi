import { Client, Discord, On } from "discordx"
import { Events } from "discord.js"
import logger from "@utils/logger"
import { GuildManager } from "@managers/GuildManager"

@Discord()
export class ReadyEvent {
  @On({ event: Events.ClientReady })
  async onReady([client]: [Client]): Promise<void> {
    logger.info("The bot is ready!")
    const guildManager = new GuildManager(client)
    await guildManager.syncAllGuilds()
    logger.info(`Successfully checked and synced guilds for ${client.user!.tag}`)
  }
}
