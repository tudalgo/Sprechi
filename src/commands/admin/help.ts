import {
  CommandInteraction,
  EmbedBuilder,
  Colors,
  MessageFlags,
} from "discord.js"
import { Discord, Slash, SlashGroup } from "discordx"
import logger from "@utils/logger"
import { injectable } from "tsyringe"

@Discord()
@injectable()
@SlashGroup("admin")
export class AdminHelp {
  @Slash({ name: "help", description: "Get help with admin commands and server setup" })
  async help(interaction: CommandInteraction): Promise<void> {
    logger.info(`Command 'admin help' triggered by ${interaction.user.username} (${interaction.user.id})`)

    if (!interaction.guild) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        flags: MessageFlags.Ephemeral,
      })
      return
    }

    try {
      const embed = new EmbedBuilder()
        .setTitle("⚙️ Admin Help - Server Setup Guide")
        .setDescription("Follow these steps to set up and manage your queue system:")
        .setColor(Colors.Gold)
        .addFields(
          {
            name: "1️⃣ Configure Roles",
            value: "`/admin role set [internal_role] [server_role]`\n"
              + "Set up internal role mappings:\n"
              + "• `admin` - Administrators who can manage the system\n"
              + "• `tutor` - Tutors who can help students\n"
              + "• `verified` - Verified members\n"
              + "• `active_session` - Role given to tutors during active sessions",
            inline: false,
          },
          {
            name: "2️⃣ Create Queues",
            value: "`/admin queue create [name] [description]`\n"
              + "Create a new queue for students to join.",
            inline: false,
          },
          {
            name: "3️⃣ Configure Queue Settings",
            value: "`/admin queue waiting-room [name] [channel]`\n"
              + "Set a voice channel as a waiting room for automatic queue joining.\n\n"
              + "`/admin queue log-channel-public [name] [channel]`\n"
              + "Set a channel for public queue activity logs.\n\n"
              + "`/admin queue log-channel-private [name] [channel]`\n"
              + "Set a channel for private tutor session logs.",
            inline: false,
          },
          {
            name: "4️⃣ Schedule & Auto-Lock",
            value: "`/admin queue schedule add [name] [day] [start] [end]`\n"
              + "Add schedule times for when the queue should be unlocked.\n\n"
              + "`/admin queue auto-lock [name] [enabled]`\n"
              + "Enable automatic queue locking based on schedule.\n\n"
              + "`/admin queue schedule shift [name] [minutes]`\n"
              + "Adjust schedule times by a specified number of minutes.",
            inline: false,
          },
          {
            name: "5️⃣ View Statistics",
            value: "`/admin stats server [show-empty-days]`\n"
              + "View server statistics including member joins and verifications.\n\n"
              + "`/admin stats sessions [queue]`\n"
              + "View session statistics for a specific queue.",
            inline: false,
          },
          {
            name: "📋 Other Useful Commands",
            value: "`/admin queue list [name]` - List members in a specific queue\n"
              + "`/admin queue summary [name]` - View queue details\n"
              + "`/admin queue lock [name]` - Manually lock a queue\n"
              + "`/admin queue unlock [name]` - Manually unlock a queue\n"
              + "`/admin role summary` - View current role mappings\n"
              + "`/admin botinfo` - View bot information",
            inline: false,
          },
        )
        .setFooter({ text: "Pro tip: Start by setting up roles, then create queues!" })

      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      })
    } catch (error) {
      logger.error("Error displaying admin help:", error)
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Error")
            .setDescription("Failed to display help information.")
            .setColor(Colors.Red),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }
  }
}
