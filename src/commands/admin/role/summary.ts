import { CommandInteraction, EmbedBuilder, MessageFlags, Colors } from "discord.js"
import { Discord, Slash, SlashGroup } from "discordx"
import { inject, injectable } from "tsyringe"
import { GuildManager } from "@managers/GuildManager"
import { InternalRole } from "@db"

@Discord()
@injectable()
@SlashGroup("role", "admin")
export class AdminRoleSummary {
  constructor(
    @inject(GuildManager) private guildManager: GuildManager
  ) { }

  @Slash({ name: "summary", description: "Show role mappings summary" })
  async summary(interaction: CommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        flags: MessageFlags.Ephemeral
      })
      return
    }

    const roles = await this.guildManager.getAllRoles(interaction.guild.id)
    const roleMap = new Map(roles.map(r => [r.type, r.roleId]))

    const allTypes = Object.values(InternalRole)
    const description = allTypes.map(type => {
      const roleId = roleMap.get(type)
      const roleMention = roleId ? `<@&${roleId}>` : "*Unassigned*"
      return `**${type}**: ${roleMention}`
    }).join("\n")

    const embed = new EmbedBuilder()
      .setTitle("Role Mappings Summary")
      .setDescription(description)
      .setColor(Colors.Blue)

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
  }
}
