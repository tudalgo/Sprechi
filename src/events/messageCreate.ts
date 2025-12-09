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
        .setTitle("❌ Invalid Token")
        .setDescription("The token you provided is invalid. Please check your token and try again.")
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
        .setTitle("❌ Server Not Found")
        .setDescription("The server for this token could not be found. The bot may not be in that server anymore.")
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
        .setTitle("✅ Verification Successful")
        .setDescription(
          `You have been verified in **${guild.name}**!\n\n`
          + `**Roles granted:**\n${roleNames.map(r => `• ${r}`).join("\n")}`,
        )
        .setColor(Colors.Green)

      await message.reply({ embeds: [embed] })
      logger.info(`[MessageCreate] User ${message.author.username} verified via DM in guild ${guild.name}`)
    } catch (error) {
      let description = "❌ An error occurred during verification. Please try again or contact an admin."

      if (error instanceof InvalidTokenError) {
        description = "❌ Invalid token. Please check your token and try again."
      } else if (error instanceof TokenAlreadyUsedError) {
        description = "❌ This token has already been used by another user."
      } else if (error instanceof UserNotInGuildError) {
        description = `❌ You are not a member of **${guild.name}**. Please join the server first, then verify.`
      }

      const embed = new EmbedBuilder()
        .setTitle("Verification Failed")
        .setDescription(description)
        .setColor(Colors.Red)

      await message.reply({ embeds: [embed] })
      logger.error(`[MessageCreate] Verification failed for ${message.author.username}:`, error)
    }
  }
}
