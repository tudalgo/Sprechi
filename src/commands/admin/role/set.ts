import { ApplicationCommandOptionType, CommandInteraction, EmbedBuilder, Role, Colors } from "discord.js"
import { Discord, Slash, SlashChoice, SlashGroup, SlashOption } from "discordx"
import { inject, injectable } from "tsyringe"
import { GuildManager } from "@managers/GuildManager"
import { InternalRole } from "@db"
import logger from "@utils/logger"
import { adminRoleCommands } from "@config/messages"

@Discord()
@injectable()
@SlashGroup({ name: "role", description: adminRoleCommands.groupDescription, root: "admin" })
export class AdminRoleSet {
  constructor(
    @inject(GuildManager) private guildManager: GuildManager,
  ) { }

  @Slash({ name: "set", description: adminRoleCommands.set.description, dmPermission: false })
  @SlashGroup("role", "admin")
  async set(
    @SlashOption({
      name: "internal_role",
      description: adminRoleCommands.set.optionInternalRole,
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    @SlashChoice(...Object.values(InternalRole))
    roleType: InternalRole,
    @SlashOption({
      name: "server_role",
      description: adminRoleCommands.set.optionServerRole,
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
        .setTitle(adminRoleCommands.set.success.title)
        .setDescription(adminRoleCommands.set.success.description(roleType, role.toString()))
        .setColor(Colors.Green)

      await interaction.reply({ embeds: [embed] })
      logger.info(`Updated role mapping for ${roleType} to ${role.name} (${role.id}) in guild ${interaction.guild.id}`)
    } catch (error) {
      logger.error(`Failed to set role mapping: ${error}`)
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(adminRoleCommands.set.errors.title)
            .setDescription(adminRoleCommands.set.errors.description)
            .setColor(Colors.Red),
        ],
      })
    }
  }
}
