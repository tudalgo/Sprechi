import {
  CommandInteraction,
  EmbedBuilder,
  Colors,
  MessageFlags,
} from "discord.js"
import { Discord, Slash, SlashGroup } from "discordx"
import logger from "@utils/logger"
import { injectable } from "tsyringe"
import { tutorCommands } from "@config/messages"

@Discord()
@injectable()
@SlashGroup("tutor")
export class TutorHelp {
  @Slash({ name: "help", description: tutorCommands.help.description, dmPermission: false })
  async help(interaction: CommandInteraction): Promise<void> {
    logger.info(`Command 'tutor help' triggered by ${interaction.user.username} (${interaction.user.id})`)

    try {
      const embed = new EmbedBuilder()
        .setTitle(tutorCommands.help.embed.title)
        .setDescription(tutorCommands.help.embed.description)
        .setColor(Colors.Purple)
        .addFields(
          {
            name: tutorCommands.help.embed.fields.startSession.name,
            value: tutorCommands.help.embed.fields.startSession.value,
            inline: false,
          },
          {
            name: tutorCommands.help.embed.fields.endSession.name,
            value: tutorCommands.help.embed.fields.endSession.value,
            inline: false,
          },
          {
            name: tutorCommands.help.embed.fields.pickNext.name,
            value: tutorCommands.help.embed.fields.pickNext.value,
            inline: false,
          },
          {
            name: tutorCommands.help.embed.fields.pickSpecific.name,
            value: tutorCommands.help.embed.fields.pickSpecific.value,
            inline: false,
          },
          {
            name: tutorCommands.help.embed.fields.listQueue.name,
            value: tutorCommands.help.embed.fields.listQueue.value,
            inline: false,
          },
          {
            name: tutorCommands.help.embed.fields.sessionSummary.name,
            value: tutorCommands.help.embed.fields.sessionSummary.value,
            inline: false,
          },
          {
            name: tutorCommands.help.embed.fields.voiceManagement.name,
            value: tutorCommands.help.embed.fields.voiceManagement.value,
            inline: false,
          },
        )
        .setFooter({ text: tutorCommands.help.embed.footer })

      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      })
    } catch (error) {
      logger.error("Error displaying tutor help:", error)
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(tutorCommands.help.errors.title)
            .setDescription(tutorCommands.help.errors.description)
            .setColor(Colors.Red),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }
  }
}
