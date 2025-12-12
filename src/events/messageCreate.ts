import { Discord, On } from "discordx"
import { Message, EmbedBuilder, Colors, ChannelType } from "discord.js"
import logger from "@utils/logger"
import { injectable, inject } from "tsyringe"
import { UserManager } from "@managers/UserManager"
import { decryptTokenString } from "@utils/token"
import {
  InvalidTokenError,
  TokenAlreadyUsedError,
  UserNotInGuildError,
} from "@errors/UserErrors"
import { events } from "@config/messages"

@Discord()
@injectable()
export class MessageCreateEvent {
  constructor(
    @inject(UserManager) private userManager: UserManager,
  ) { }

  @On({ event: "messageCreate" })
  async onMessage([message]: [Message]) {
    // Only process DMs to the bot
    if (message.channel.type !== ChannelType.DM || message.author.bot) {
      return
    }

    const token = message.content.trim()

    // First, decrypt the token to get the guild ID
    const tokenData = decryptTokenString(token)
    if (!tokenData) {
      const embed = new EmbedBuilder()
        .setTitle(events.messageCreate.invalidToken.title)
        .setDescription(events.messageCreate.invalidToken.description)
        .setColor(Colors.Red)

      await message.reply({ embeds: [embed] })
      logger.warn(`[MessageCreate] Invalid token from ${message.author.username}`)
      return
    }

    // Import bot lazily to avoid circular dependency
    const { bot } = await import("@/bot")

    // Get the specific guild from the token
    const guild = await bot.guilds.fetch(tokenData.serverId)
    if (!guild) {
      const embed = new EmbedBuilder()
        .setTitle(events.messageCreate.missingServer.title)
        .setDescription(events.messageCreate.missingServer.description)
        .setColor(Colors.Red)

      await message.reply({ embeds: [embed] })
      logger.warn(`[MessageCreate] Guild ${tokenData.serverId} not found for user ${message.author.username}`)
      return
    }

    // Verify the user is in the guild
    try {
      const member = await guild.members.fetch(message.author.id)
      const roleNames = await this.userManager.verifyUser(member, token)

      const embed = new EmbedBuilder()
        .setTitle(events.messageCreate.success.title)
        .setDescription(events.messageCreate.success.description(guild.name, roleNames))
        .setColor(Colors.Green)

      await message.reply({ embeds: [embed] })
      logger.info(`[MessageCreate] User ${message.author.username} verified via DM in guild ${guild.name}`)
    } catch (error) {
      let description = events.messageCreate.errors.defaultDescription

      if (error instanceof InvalidTokenError) {
        description = events.messageCreate.errors.invalidToken
      } else if (error instanceof TokenAlreadyUsedError) {
        description = events.messageCreate.errors.tokenAlreadyUsed
      } else if (error instanceof UserNotInGuildError) {
        description = events.messageCreate.errors.userNotInGuild(guild.name)
      }

      const embed = new EmbedBuilder()
        .setTitle(events.messageCreate.errors.title)
        .setDescription(description)
        .setColor(Colors.Red)

      await message.reply({ embeds: [embed] })
      logger.error(`[MessageCreate] Verification failed for ${message.author.username}:`, error)
    }
  }
}
