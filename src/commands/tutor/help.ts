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
@SlashGroup("tutor")
export class TutorHelp {
  @Slash({ name: "help", description: "Get help with tutor commands", dmPermission: false })
  async help(interaction: CommandInteraction): Promise<void> {
    logger.info(`Command 'tutor help' triggered by ${interaction.user.username} (${interaction.user.id})`)

    try {
      const embed = new EmbedBuilder()
        .setTitle("🎓 Tutor Help - Tutor Commands")
        .setDescription("Here are the available commands for tutors to manage sessions and help students:")
        .setColor(Colors.Purple)
        .addFields(
          {
            name: "🟢 Start a Session",
            value: "`/tutor session start [queue]`\nStart a tutoring session on a queue. If no queue is specified, the default queue will be used.",
            inline: false,
          },
          {
            name: "🔴 End a Session",
            value: "`/tutor session end`\nEnd your current tutoring session.",
            inline: false,
          },
          {
            name: "➡️ Pick Next Student",
            value: "`/tutor queue next`\nPick the next student from your active queue. This will create a private voice channel for you and the student.",
            inline: false,
          },
          {
            name: "👤 Pick Specific Student",
            value: "`/tutor queue pick [user]`\nPick a specific student from your active queue.",
            inline: false,
          },
          {
            name: "📋 List Queue Members",
            value: "`/tutor queue list [max_entries]`\nView members waiting in your active session's queue.",
            inline: false,
          },
          {
            name: "📊 Session Summary",
            value: "`/tutor summary`\nView a summary of your current session, including students helped.",
            inline: false,
          },
          {
            name: "🎤 Voice Channel Management",
            value: "`/tutor voice close` - Close your current temporary voice channel\n"
              + "`/tutor voice kick [user]` - Kick a user from your voice channel\n"
              + "`/tutor voice permit [user]` - Grant a user access to your voice channel",
            inline: false,
          },
        )
        .setFooter({ text: "Tip: Use /tutor session start to begin helping students!" })

      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      })
    } catch (error) {
      logger.error("Error displaying tutor help:", error)
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
