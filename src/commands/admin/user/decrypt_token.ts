import { CommandInteraction, EmbedBuilder, MessageFlags, Colors, ApplicationCommandOptionType } from "discord.js"
import { Discord, Slash, SlashGroup, SlashOption } from "discordx"
import { injectable } from "tsyringe"
import { decryptTokenString } from "@utils/token"
import logger from "@utils/logger"

@Discord()
@injectable()
@SlashGroup("admin")
export class AdminDecryptTokenCommand {
  @Slash({ name: "decrypt-token", description: "Decrypt a token to view its contents" })
  async decryptToken(
    @SlashOption({
      name: "token",
      description: "The encrypted token to decrypt",
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
          .setTitle("❌ Invalid Token")
          .setDescription("The provided token could not be decrypted or is invalid")
          .setColor(Colors.Red)

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
        return
      }

      const embed = new EmbedBuilder()
        .setTitle("🔓 Decrypted Token")
        .addFields(
          { name: "Server ID", value: tokenData.serverId, inline: true },
          { name: "Version ID", value: tokenData.versionId, inline: true },
          { name: "TU ID", value: tokenData.tuId || "Not set", inline: true },
          { name: "Moodle ID", value: tokenData.moodleId || "Not set", inline: true },
          { name: "Roles", value: tokenData.roles.join(", "), inline: false },
        )
        .setColor(Colors.Blue)
        .setFooter({ text: "⚠️ Keep token information confidential" })

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
      logger.info(`[AdminDecryptToken] Admin ${interaction.user.username} decrypted a token`)
    } catch (error) {
      const embed = new EmbedBuilder()
        .setTitle("❌ Decryption Failed")
        .setDescription("An error occurred while decrypting the token")
        .setColor(Colors.Red)

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
      logger.error("[AdminDecryptToken] Decryption failed:", error)
    }
  }
}
