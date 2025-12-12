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
export class AdminQueueLogChannelPrivate {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager,
  ) { }

  @Slash({ name: "set-private-log-channel", description: adminQueueCommands.logChannel.setPrivate.description, dmPermission: false })
  async setPrivateLogChannel(
    @SlashOption({
      name: "name",
      description: adminQueueCommands.logChannel.setPrivate.optionName,
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    name: string,
    @SlashOption({
      name: "channel",
      description: adminQueueCommands.logChannel.setPrivate.optionChannel,
      required: true,
      type: ApplicationCommandOptionType.Channel,
      channelTypes: [ChannelType.GuildText],
    })
    channel: TextChannel,
    interaction: CommandInteraction,
  ): Promise<void> {
    logger.info(`Command 'set-private-log-channel' triggered by ${interaction.user.username} (${interaction.user.id}) for queue '${name}'`)

    if (!interaction.guild) return

    try {
      await this.queueManager.setPrivateLogChannel(interaction.guild.id, name, channel.id)
      logger.info(`Private log channel for queue '${name}' set to channel '${channel.name}' (${channel.id}) in guild '${interaction.guild.name}' (${interaction.guild.id})`)

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(adminQueueCommands.logChannel.setPrivate.success.title)
            .setDescription(adminQueueCommands.logChannel.setPrivate.success.description(name, channel.id))
            .setColor(Colors.Green),
        ],
      })
    } catch (error: unknown) {
      let errorMessage = "Failed to set log channel."
      if (error instanceof QueueNotFoundError) {
        errorMessage = adminQueueCommands.logChannel.setPrivate.errors.notFound(name)
        logger.warn(`Failed to set log channel: Queue '${name}' not found in guild '${interaction.guild.id}'`)
      } else {
        logger.error(`Error setting log channel for queue '${name}':`, error)
      }

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(adminQueueCommands.logChannel.setPrivate.errors.title)
            .setDescription(errorMessage)
            .setColor(Colors.Red),
        ],
      })
    }
  }
}
