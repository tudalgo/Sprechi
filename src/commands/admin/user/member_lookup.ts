import { CommandInteraction, EmbedBuilder, MessageFlags, Colors, User, ApplicationCommandOptionType } from "discord.js"
import { Discord, Slash, SlashGroup, SlashOption } from "discordx"
import { injectable, inject } from "tsyringe"
import { UserManager } from "@managers/UserManager"
import logger from "@utils/logger"
import { UserNotVerifiedError, UserNotInGuildError } from "@errors/UserErrors"
import { adminUserCommands } from "@config/messages"

@Discord()
@injectable()
@SlashGroup({ name: "user", description: adminUserCommands.groupDescription, root: "admin" })
@SlashGroup("user", "admin")
export class AdminMemberLookupCommand {
  constructor(
    @inject(UserManager) private userManager: UserManager,
  ) { }

  @Slash({ name: "lookup", description: adminUserCommands.memberLookup.description, dmPermission: false })
  async memberLookup(
    @SlashOption({
      name: "user",
      description: adminUserCommands.memberLookup.optionUser,
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
          .setTitle(adminUserCommands.memberLookup.missingMember.title)
          .setDescription(adminUserCommands.memberLookup.missingMember.description)
          .setColor(Colors.Red)

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
        return
      }

      const userData = await this.userManager.getUserData(member)

      const embed = new EmbedBuilder()
        .setTitle(adminUserCommands.memberLookup.success.title)
        .setThumbnail(member.user.displayAvatarURL())
        .addFields(
          { name: adminUserCommands.memberLookup.success.fields.discordUser, value: `${member.user.username} (${user.id})`, inline: false },
          { name: adminUserCommands.memberLookup.success.fields.tuId, value: userData.tuId || adminUserCommands.memberLookup.success.notAvailable, inline: true },
          { name: adminUserCommands.memberLookup.success.fields.moodleId, value: userData.moodleId || adminUserCommands.memberLookup.success.notAvailable, inline: true },
          { name: adminUserCommands.memberLookup.success.fields.verifiedAt, value: userData.verifiedAt ? `<t:${Math.floor(userData.verifiedAt.getTime() / 1000)}:F>` : adminUserCommands.memberLookup.success.unknown, inline: false },
        )
        .setColor(Colors.Blue)

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
      logger.info(`[AdminMemberLookup] Admin ${interaction.user.username} looked up user ${member.user.username}`)
    } catch (error) {
      let description = adminUserCommands.memberLookup.errors.default

      if (error instanceof UserNotVerifiedError) {
        description = adminUserCommands.memberLookup.errors.notVerified
      } else if (error instanceof UserNotInGuildError) {
        description = adminUserCommands.memberLookup.errors.notInGuild
      }

      const embed = new EmbedBuilder()
        .setTitle(adminUserCommands.memberLookup.errors.title)
        .setDescription(description)
        .setColor(Colors.Red)

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
      logger.error("[AdminMemberLookup] Lookup failed:", error)
    }
  }
}
