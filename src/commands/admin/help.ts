import {
  CommandInteraction,
  EmbedBuilder,
  Colors,
} from "discord.js"
import { Discord, Slash, SlashGroup } from "discordx"
import logger from "@utils/logger"
import { injectable } from "tsyringe"
import { adminCommands } from "@config/messages"

@Discord()
@injectable()
@SlashGroup("admin")
export class AdminHelp {
  @Slash({ name: "help", description: adminCommands.help.description, dmPermission: false })
  async help(interaction: CommandInteraction): Promise<void> {
    logger.info(`Command 'admin help' triggered by ${interaction.user.username} (${interaction.user.id})`)

    try {
      const embed = new EmbedBuilder()
        .setTitle(adminCommands.help.embed.title)
        .setDescription(adminCommands.help.embed.description)
        .setColor(Colors.Gold)
        .addFields(
          {
            name: adminCommands.help.embed.fields.configureRoles.name,
            value: adminCommands.help.embed.fields.configureRoles.value,
            inline: false,
          },
          {
            name: adminCommands.help.embed.fields.createQueues.name,
            value: adminCommands.help.embed.fields.createQueues.value,
            inline: false,
          },
          {
            name: adminCommands.help.embed.fields.configureSettings.name,
            value: adminCommands.help.embed.fields.configureSettings.value,
            inline: false,
          },
          {
            name: adminCommands.help.embed.fields.scheduleAutoLock.name,
            value: adminCommands.help.embed.fields.scheduleAutoLock.value,
            inline: false,
          },
          {
            name: adminCommands.help.embed.fields.viewStats.name,
            value: adminCommands.help.embed.fields.viewStats.value,
            inline: false,
          },
          {
            name: adminCommands.help.embed.fields.otherCommands.name,
            value: adminCommands.help.embed.fields.otherCommands.value,
            inline: false,
          },
        )
        .setFooter({ text: adminCommands.help.embed.footer })

      await interaction.reply({
        embeds: [embed],
      })
    } catch (error) {
      logger.error("Error displaying admin help:", error)
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(adminCommands.help.errors.title)
            .setDescription(adminCommands.help.errors.description)
            .setColor(Colors.Red),
        ],
      })
    }
  }
}
