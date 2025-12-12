import { CommandInteraction, EmbedBuilder, MessageFlags, Colors, ApplicationCommandOptionType } from "discord.js"
import { Discord, Slash, SlashOption } from "discordx"
import { injectable, inject } from "tsyringe"
import { UserManager } from "@managers/UserManager"
import logger from "@utils/logger"
import {
  InvalidTokenError,
  TokenAlreadyUsedError,
  WrongServerError,
  UserNotInGuildError,
} from "@errors/UserErrors"
import { verifyCommand } from "@config/messages"

@Discord()
@injectable()
export class VerifyCommand {
  constructor(
    @inject(UserManager) private userManager: UserManager,
  ) { }

  @Slash({ name: "verify", description: verifyCommand.description, dmPermission: false })
  async verify(
    @SlashOption({
      name: "token",
      description: verifyCommand.optionToken,
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    token: string,
    interaction: CommandInteraction,
  ): Promise<void> {
    try {
      if (!interaction.guild) {
        return
      }

      const member = await interaction.guild.members.fetch(interaction.user.id)
      const roleNames = await this.userManager.verifyUser(member, token)

      const embed = new EmbedBuilder()
        .setTitle(verifyCommand.success.title)
        .setDescription(verifyCommand.success.description(roleNames))
        .setColor(Colors.Green)

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
      logger.info(`[VerifyCommand] User ${interaction.user.username} verified successfully via command`)
    } catch (error) {
      let description = verifyCommand.errors.default

      if (error instanceof InvalidTokenError) {
        description = verifyCommand.errors.invalidToken
      } else if (error instanceof TokenAlreadyUsedError) {
        description = verifyCommand.errors.tokenAlreadyUsed
      } else if (error instanceof WrongServerError) {
        description = verifyCommand.errors.wrongServer
      } else if (error instanceof UserNotInGuildError) {
        description = verifyCommand.errors.userNotInGuild
      }

      const embed = new EmbedBuilder()
        .setTitle(verifyCommand.errors.title)
        .setDescription(description)
        .setColor(Colors.Red)

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
      logger.error(`[VerifyCommand] Verification failed for ${interaction.user.username}:`, error)
    }
  }
}
