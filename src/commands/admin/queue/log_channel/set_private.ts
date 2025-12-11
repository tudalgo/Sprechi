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

@Discord()
@injectable()
@SlashGroup("queue", "admin")
export class AdminQueueLogChannelPrivate {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager,
  ) { }

  @Slash({ name: "set-private-log-channel", description: "Set the private log channel for a queue", dmPermission: false })
  async setPrivateLogChannel(
    @SlashOption({
      name: "name",
      description: "The name of the queue",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    name: string,
    @SlashOption({
      name: "channel",
      description: "The text channel to use for logs",
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
            .setTitle("Private Log Channel Set")
            .setDescription(`Private log channel for queue **${name}** set to <#${channel.id}>.`)
            .setColor(Colors.Green),
        ],
      })
    } catch (error: unknown) {
      let errorMessage = "Failed to set log channel."
      if (error instanceof QueueNotFoundError) {
        errorMessage = `Queue **${name}** not found.`
        logger.warn(`Failed to set log channel: Queue '${name}' not found in guild '${interaction.guild.id}'`)
      } else {
        logger.error(`Error setting log channel for queue '${name}':`, error)
      }

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Error")
            .setDescription(errorMessage)
            .setColor(Colors.Red),
        ],
      })
    }
  }
}
