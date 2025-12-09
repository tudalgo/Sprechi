import { CommandInteraction, EmbedBuilder, MessageFlags, Colors, ApplicationCommandOptionType } from "discord.js"
import { Discord, Slash, SlashGroup, SlashOption, SlashChoice } from "discordx"
import { injectable, inject } from "tsyringe"
import { UserManager } from "@managers/UserManager"
import logger from "@utils/logger"
import { UserNotVerifiedError } from "@errors/UserErrors"

export enum IdType {
  Discord = "discord",
  TU = "tu",
  Moodle = "moodle",
}

@Discord()
@injectable()
@SlashGroup("admin")
export class AdminSearchCommand {
  constructor(
    @inject(UserManager) private userManager: UserManager,
  ) { }

  @Slash({ name: "user-search", description: "Search for a user by their ID" })
  async search(
    @SlashChoice({ name: "Discord ID", value: IdType.Discord })
    @SlashChoice({ name: "TU ID", value: IdType.TU })
    @SlashChoice({ name: "Moodle ID", value: IdType.Moodle })
    @SlashOption({
      name: "id_type",
      description: "The type of ID to search by",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    idType: IdType,
    @SlashOption({
      name: "id_value",
      description: "The ID value to search for",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    idValue: string,
    interaction: CommandInteraction,
  ): Promise<void> {
    try {
      if (!interaction.guild) {
        const embed = new EmbedBuilder()
          .setTitle("❌ Error")
          .setDescription("This command can only be used in a server")
          .setColor(Colors.Red)

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
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
        .setTitle("🔍 Search Results")
        .addFields(
          { name: "Discord ID", value: userData.discordId, inline: true },
          { name: "Discord User", value: discordUser ? discordUser.username : "Unknown", inline: true },
          { name: "TU ID", value: userData.tuId || "Not available", inline: true },
          { name: "Moodle ID", value: userData.moodleId || "Not available", inline: true },
          { name: "Verified At", value: userData.verifiedAt ? `<t:${Math.floor(userData.verifiedAt.getTime() / 1000)}:F>` : "Unknown", inline: false },
        )
        .setColor(Colors.Blue)

      if (discordUser) {
        embed.setThumbnail(discordUser.displayAvatarURL())
      }

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
      logger.info(`[AdminSearch] Admin ${interaction.user.username} searched for ${idType}=${idValue}`)
    } catch (error) {
      let description = "An error occurred while searching"

      if (error instanceof UserNotVerifiedError) {
        description = "❌ No user found with the specified ID."
      }

      const embed = new EmbedBuilder()
        .setTitle("Search Failed")
        .setDescription(description)
        .setColor(Colors.Red)

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
      logger.error("[AdminSearch] Search failed:", error)
    }
  }
}
