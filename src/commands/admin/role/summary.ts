import { CommandInteraction, EmbedBuilder, Colors } from "discord.js"
import { Discord, Slash, SlashGroup } from "discordx"
import { inject, injectable } from "tsyringe"
import { GuildManager } from "@managers/GuildManager"
import { InternalRole } from "@db"
import { adminRoleCommands } from "@config/messages"

@Discord()
@injectable()
@SlashGroup("role", "admin")
export class AdminRoleSummary {
  constructor(
    @inject(GuildManager) private guildManager: GuildManager,
  ) { }

  @Slash({ name: "summary", description: adminRoleCommands.summary.description, dmPermission: false })
  async summary(interaction: CommandInteraction): Promise<void> {
    if (!interaction.guild) return

    const roles = await this.guildManager.getAllRoles(interaction.guild.id)
    const roleMap = new Map(roles.map(r => [r.type, r.roleId]))

    const allTypes = Object.values(InternalRole)
    const description = allTypes.map((type) => {
      const roleId = roleMap.get(type)
      const roleMention = roleId ? `<@&${roleId}>` : adminRoleCommands.summary.unassigned
      return adminRoleCommands.summary.line(type, roleMention)
    }).join("\n")

    const embed = new EmbedBuilder()
      .setTitle(adminRoleCommands.summary.title)
      .setDescription(description)
      .setColor(Colors.Blue)

    await interaction.reply({ embeds: [embed] })
  }
}
