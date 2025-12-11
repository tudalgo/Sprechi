import { ApplicationCommandOptionType, CommandInteraction, EmbedBuilder, Role, Colors } from "discord.js"
import { Discord, Slash, SlashChoice, SlashGroup, SlashOption } from "discordx"
import { inject, injectable } from "tsyringe"
import { GuildManager } from "@managers/GuildManager"
import { InternalRole } from "@db"
import logger from "@utils/logger"

@Discord()
@injectable()
@SlashGroup({ name: "role", description: "Role management commands", root: "admin" })
export class AdminRoleSet {
  constructor(
    @inject(GuildManager) private guildManager: GuildManager,
  ) { }

  @Slash({ name: "set", description: "Set an internal role mapping", dmPermission: false })
  @SlashGroup("role", "admin")
  async set(
    @SlashOption({
      name: "internal_role",
      description: "The internal role to map",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    @SlashChoice(...Object.values(InternalRole))
    roleType: InternalRole,
    @SlashOption({
      name: "server_role",
      description: "The server role to assign",
      required: true,
      type: ApplicationCommandOptionType.Role,
    })
    role: Role,
    interaction: CommandInteraction,
  ): Promise<void> {
    if (!interaction.guild) return

    try {
      await this.guildManager.setRole(interaction.guild.id, roleType, role.id)

      const embed = new EmbedBuilder()
        .setTitle("Role Mapping Updated")
        .setDescription(`Mapped internal role **${roleType}** to server role ${role.toString()}`)
        .setColor(Colors.Green)

      await interaction.reply({ embeds: [embed] })
      logger.info(`Updated role mapping for ${roleType} to ${role.name} (${role.id}) in guild ${interaction.guild.id}`)
    } catch (error) {
      logger.error(`Failed to set role mapping: ${error}`)
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Error")
            .setDescription("An error occurred while setting the role mapping.")
            .setColor(Colors.Red),
        ],
      })
    }
  }
}
