import { CommandInteraction, EmbedBuilder, MessageFlags, Colors, User, ApplicationCommandOptionType } from "discord.js"
import { Discord, Slash, SlashGroup, SlashOption } from "discordx"
import { injectable, inject } from "tsyringe"
import { UserManager } from "@managers/UserManager"
import logger from "@utils/logger"
import { UserNotVerifiedError, UserNotInGuildError } from "@errors/UserErrors"

@Discord()
@injectable()
@SlashGroup("admin")
export class AdminMemberLookupCommand {
  constructor(
    @inject(UserManager) private userManager: UserManager,
  ) { }

  @Slash({ name: "member-lookup", description: "Look up information about a verified user", dmPermission: false })
  async memberLookup(
    @SlashOption({
      name: "user",
      description: "The user to look up",
      required: true,
      type: ApplicationCommandOptionType.User,
    })
    user: User,
    interaction: CommandInteraction,
  ): Promise<void> {
    try {
      if (!interaction.guild) {
        return
      }

      // Check if user is in the current guild
      let member
      try {
        member = await interaction.guild.members.fetch(user.id)
      } catch {
        const embed = new EmbedBuilder()
          .setTitle("❌ User Not Found")
          .setDescription("This user is not a member of this server")
          .setColor(Colors.Red)

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
        return
      }

      const userData = await this.userManager.getUserData(member)

      const embed = new EmbedBuilder()
        .setTitle("👤 User Information")
        .setThumbnail(member.user.displayAvatarURL())
        .addFields(
          { name: "Discord User", value: `${member.user.username} (${user.id})`, inline: false },
          { name: "TU ID", value: userData.tuId || "Not available", inline: true },
          { name: "Moodle ID", value: userData.moodleId || "Not available", inline: true },
          { name: "Verified At", value: userData.verifiedAt ? `<t:${Math.floor(userData.verifiedAt.getTime() / 1000)}:F>` : "Unknown", inline: false },
        )
        .setColor(Colors.Blue)

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
      logger.info(`[AdminMemberLookup] Admin ${interaction.user.username} looked up user ${member.user.username}`)
    } catch (error) {
      let description = "An error occurred while looking up user information"

      if (error instanceof UserNotVerifiedError) {
        description = "❌ This user is not verified on this server."
      } else if (error instanceof UserNotInGuildError) {
        description = "❌ This user is not a member of this server."
      }

      const embed = new EmbedBuilder()
        .setTitle("Lookup Failed")
        .setDescription(description)
        .setColor(Colors.Red)

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
      logger.error("[AdminMemberLookup] Lookup failed:", error)
    }
  }
}
