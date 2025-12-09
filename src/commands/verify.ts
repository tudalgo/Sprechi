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

@Discord()
@injectable()
export class VerifyCommand {
  constructor(
    @inject(UserManager) private userManager: UserManager,
  ) { }

  @Slash({ name: "verify", description: "Verify your account with a token" })
  async verify(
    @SlashOption({
      name: "token",
      description: "Your verification token",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    token: string,
    interaction: CommandInteraction,
  ): Promise<void> {
    try {
      if (!interaction.guild || !interaction.member) {
        const embed = new EmbedBuilder()
          .setTitle("❌ Error")
          .setDescription("This command can only be used in a server")
          .setColor(Colors.Red)

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
        return
      }

      const member = await interaction.guild.members.fetch(interaction.user.id)
      const roleNames = await this.userManager.verifyUser(member, token)

      const embed = new EmbedBuilder()
        .setTitle("✅ Verification Successful")
        .setDescription(`You have been verified and granted the following roles:\n${roleNames.map(r => `• ${r}`).join("\n")}`)
        .setColor(Colors.Green)

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
      logger.info(`[VerifyCommand] User ${interaction.user.username} verified successfully via command`)
    } catch (error) {
      let description = "An unknown error occurred during verification"

      if (error instanceof InvalidTokenError) {
        description = "❌ Invalid token. Please check your token and try again."
      } else if (error instanceof TokenAlreadyUsedError) {
        description = "❌ This token has already been used by another user."
      } else if (error instanceof WrongServerError) {
        description = "❌ This token is for a different server."
      } else if (error instanceof UserNotInGuildError) {
        description = "❌ You must be a member of this server to verify."
      }

      const embed = new EmbedBuilder()
        .setTitle("Verification Failed")
        .setDescription(description)
        .setColor(Colors.Red)

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
      logger.error(`[VerifyCommand] Verification failed for ${interaction.user.username}:`, error)
    }
  }
}
