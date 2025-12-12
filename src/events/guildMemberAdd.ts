import { Discord, On } from "discordx"
import { GuildMember, EmbedBuilder, Colors } from "discord.js"
import logger from "@utils/logger"
import { injectable, inject } from "tsyringe"
import { UserManager } from "@managers/UserManager"
import { events } from "@config/messages"

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
        .setTitle(events.guildMemberAdd.dm.title(member.guild.name))
        .setDescription(events.guildMemberAdd.dm.description)
        .setColor(Colors.Blue)
        .setThumbnail(member.guild.iconURL() || "")
        .setFooter({ text: events.guildMemberAdd.dm.footer })

      await member.send({ embeds: [embed] })
      logger.info(`[GuildMemberAdd] Sent welcome message to ${member.user.username} (${member.user.id})`)
    } catch (error) {
      logger.warn(`[GuildMemberAdd] Could not send welcome message to ${member.user.username}:`, error)
    }
  }
}
