import { CommandInteraction, EmbedBuilder, MessageFlags, Colors, ApplicationCommandOptionType } from "discord.js"
import { Discord, Slash, SlashGroup, SlashOption } from "discordx"
import { injectable } from "tsyringe"
import { decryptTokenString } from "@utils/token"
import logger from "@utils/logger"
import { adminUserCommands } from "@config/messages"

@Discord()
@injectable()
@SlashGroup("admin")
export class AdminDecryptTokenCommand {
  @Slash({ name: "decrypt-token", description: adminUserCommands.decryptToken.description, dmPermission: false })
  async decryptToken(
    @SlashOption({
      name: "token",
      description: adminUserCommands.decryptToken.optionToken,
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    token: string,
    interaction: CommandInteraction,
  ): Promise<void> {
    try {
      const tokenData = decryptTokenString(token)

      if (!tokenData) {
        const embed = new EmbedBuilder()
          .setTitle(adminUserCommands.decryptToken.invalidToken.title)
          .setDescription(adminUserCommands.decryptToken.invalidToken.description)
          .setColor(Colors.Red)

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
        return
      }

      const embed = new EmbedBuilder()
        .setTitle(adminUserCommands.decryptToken.success.title)
        .addFields(
          { name: adminUserCommands.decryptToken.success.fields.serverId, value: tokenData.serverId, inline: true },
          { name: adminUserCommands.decryptToken.success.fields.versionId, value: tokenData.versionId, inline: true },
          { name: adminUserCommands.decryptToken.success.fields.tuId, value: tokenData.tuId || adminUserCommands.decryptToken.success.notSet, inline: true },
          { name: adminUserCommands.decryptToken.success.fields.moodleId, value: tokenData.moodleId || adminUserCommands.decryptToken.success.notSet, inline: true },
          { name: adminUserCommands.decryptToken.success.fields.roles, value: tokenData.roles.join(", "), inline: false },
        )
        .setColor(Colors.Blue)
        .setFooter({ text: adminUserCommands.decryptToken.success.footer })

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
      logger.info(`[AdminDecryptToken] Admin ${interaction.user.username} decrypted a token`)
    } catch (error) {
      const embed = new EmbedBuilder()
        .setTitle(adminUserCommands.decryptToken.failure.title)
        .setDescription(adminUserCommands.decryptToken.failure.description)
        .setColor(Colors.Red)

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
      logger.error("[AdminDecryptToken] Decryption failed:", error)
    }
  }
}
