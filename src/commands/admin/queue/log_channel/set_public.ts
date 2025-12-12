import {
  ApplicationCommandOptionType,
  CommandInteraction,
  EmbedBuilder,
  Colors,
  ChannelType,
  TextChannel,
} from "discord.js"
import { Discord, Slash, SlashGroup, SlashOption } from "discordx"
import { QueueManager } from "@managers/QueueManager"
import { QueueNotFoundError } from "@errors/QueueErrors"
import logger from "@utils/logger"
import { inject, injectable } from "tsyringe"
import { adminQueueCommands } from "@config/messages"

@Discord()
@injectable()
@SlashGroup("queue", "admin")
export class AdminQueueLogChannelPublic {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager,
  ) { }

  @Slash({ name: "set-public-log-channel", description: adminQueueCommands.logChannel.setPublic.description, dmPermission: false })
  async setPublicLogChannel(
    @SlashOption({
      name: "name",
      description: adminQueueCommands.logChannel.setPublic.optionName,
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    name: string,
    @SlashOption({
      name: "channel",
      description: adminQueueCommands.logChannel.setPublic.optionChannel,
      required: true,
      type: ApplicationCommandOptionType.Channel,
      channelTypes: [ChannelType.GuildText],
    })
    channel: TextChannel,
    interaction: CommandInteraction,
  ): Promise<void> {
    logger.info(`Command 'set-public-log-channel' triggered by ${interaction.user.username} (${interaction.user.id}) for queue '${name}'`)

    if (!interaction.guild) return

    try {
      await this.queueManager.setPublicLogChannel(interaction.guild.id, name, channel.id)
      logger.info(`Public log channel for queue '${name}' set to channel '${channel.name}' (${channel.id}) in guild '${interaction.guild.name}' (${interaction.guild.id})`)

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(adminQueueCommands.logChannel.setPublic.success.title)
            .setDescription(adminQueueCommands.logChannel.setPublic.success.description(name, channel.id))
            .setColor(Colors.Green),
        ],
      })
    } catch (error: unknown) {
      let errorMessage = "Failed to set public log channel."
      if (error instanceof QueueNotFoundError) {
        errorMessage = adminQueueCommands.logChannel.setPublic.errors.notFound(name)
        logger.warn(`Failed to set public log channel: Queue '${name}' not found in guild '${interaction.guild.id}'`)
      } else {
        logger.error(`Error setting public log channel for queue '${name}':`, error)
      }

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(adminQueueCommands.logChannel.setPublic.errors.title)
            .setDescription(errorMessage)
            .setColor(Colors.Red),
        ],
      })
    }
  }
}
