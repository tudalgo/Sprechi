import { Discord, On } from "discordx"
import { GuildMember, EmbedBuilder, Colors } from "discord.js"
import logger from "@utils/logger"
import { injectable, inject } from "tsyringe"
import { UserManager } from "@managers/UserManager"

@Discord()
@injectable()
export class GuildMemberAddEvent {
  constructor(
    @inject(UserManager) private userManager: UserManager,
  ) { }

  @On({ event: "guildMemberAdd" })
  async onMemberJoin([member]: [GuildMember]) {
    // Try to reapply saved roles if user was previously verified
    try {
      await this.userManager.reapplyRoles(member)
    } catch {
      // Ignore errors - user may not have been verified before
    }

    // Send welcome message
    try {
      const embed = new EmbedBuilder()
        .setTitle(`Welcome to ${member.guild.name}! 🎉`)
        .setDescription(
          "To get full access to the server, you need to verify your account.\n\n"
          + "**How to verify:**\n"
          + "• If you have a verification token, simply paste it in this DM\n"
          + "• Alternatively, use the `/verify` command in the server with your token\n\n"
          + "Once verified, you'll receive your roles automatically!",
        )
        .setColor(Colors.Blue)
        .setThumbnail(member.guild.iconURL() || "")
        .setFooter({ text: "Need help? Contact a server admin." })

      await member.send({ embeds: [embed] })
      logger.info(`[GuildMemberAdd] Sent welcome message to ${member.user.username} (${member.user.id})`)
    } catch (error) {
      logger.warn(`[GuildMemberAdd] Could not send welcome message to ${member.user.username}:`, error)
    }
  }
}
