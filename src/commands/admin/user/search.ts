import { CommandInteraction, EmbedBuilder, MessageFlags, Colors, ApplicationCommandOptionType } from "discord.js"
import { Discord, Slash, SlashGroup, SlashOption, SlashChoice } from "discordx"
import { injectable, inject } from "tsyringe"
import { UserManager } from "@managers/UserManager"
import logger from "@utils/logger"
import { UserNotVerifiedError } from "@errors/UserErrors"
import { adminUserCommands } from "@config/messages"

export enum IdType {
  Discord = "discord",
  TU = "tu",
  Moodle = "moodle",
}

@Discord()
@injectable()
@SlashGroup("user", "admin")
export class AdminSearchCommand {
  constructor(
    @inject(UserManager) private userManager: UserManager,
  ) { }

  @Slash({ name: "search", description: adminUserCommands.search.description, dmPermission: false })
  async search(
    @SlashChoice({ name: adminUserCommands.search.choices.discordId, value: IdType.Discord })
    @SlashChoice({ name: adminUserCommands.search.choices.tuId, value: IdType.TU })
    @SlashChoice({ name: adminUserCommands.search.choices.moodleId, value: IdType.Moodle })
    @SlashOption({
      name: "id_type",
      description: adminUserCommands.search.optionIdType,
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    idType: IdType,
    @SlashOption({
      name: "id_value",
      description: adminUserCommands.search.optionIdValue,
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    idValue: string,
    interaction: CommandInteraction,
  ): Promise<void> {
    try {
      if (!interaction.guild) {
        return
      }

      const userData = await this.userManager.searchUser(interaction.guild.id, idType, idValue)

      // Try to fetch the Discord user
      let discordUser
      try {
        discordUser = await interaction.client.users.fetch(userData.discordId)
      } catch {
        discordUser = null
      }

      const embed = new EmbedBuilder()
        .setTitle(adminUserCommands.search.success.title)
        .addFields(
          { name: adminUserCommands.search.success.fields.discordId, value: userData.discordId, inline: true },
          { name: adminUserCommands.search.success.fields.discordUser, value: discordUser ? discordUser.username : adminUserCommands.search.success.unknown, inline: true },
          { name: adminUserCommands.search.success.fields.tuId, value: userData.tuId || adminUserCommands.search.success.notAvailable, inline: true },
          { name: adminUserCommands.search.success.fields.moodleId, value: userData.moodleId || adminUserCommands.search.success.notAvailable, inline: true },
          { name: adminUserCommands.search.success.fields.verifiedAt, value: userData.verifiedAt ? `<t:${Math.floor(userData.verifiedAt.getTime() / 1000)}:F>` : adminUserCommands.search.success.unknown, inline: false },
        )
        .setColor(Colors.Blue)

      if (discordUser) {
        embed.setThumbnail(discordUser.displayAvatarURL())
      }

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
      logger.info(`[AdminSearch] Admin ${interaction.user.username} searched for ${idType}=${idValue}`)
    } catch (error) {
      let description = adminUserCommands.search.errors.default

      if (error instanceof UserNotVerifiedError) {
        description = adminUserCommands.search.errors.notFound
      }

      const embed = new EmbedBuilder()
        .setTitle(adminUserCommands.search.errors.title)
        .setDescription(description)
        .setColor(Colors.Red)

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
      logger.error("[AdminSearch] Search failed:", error)
    }
  }
}
