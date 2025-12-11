import {
  ApplicationCommandOptionType,
  CommandInteraction,
  EmbedBuilder,
  Colors,
  MessageFlags,
  ChannelType,
  VoiceChannel,
} from "discord.js"
import { Discord, Slash, SlashGroup, SlashOption } from "discordx"
import { QueueManager } from "@managers/QueueManager"
import { QueueNotFoundError } from "../../../errors/QueueErrors"
import logger from "@utils/logger"
import { inject, injectable } from "tsyringe"

@Discord()
@injectable()
@SlashGroup("queue", "admin")
export class AdminQueueWaitingRoom {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager,
  ) { }

  @Slash({ name: "waiting-room", description: "Set the waiting room for a queue", dmPermission: false })
  async setWaitingRoom(
    @SlashOption({
      name: "name",
      description: "The name of the queue",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    name: string,
    @SlashOption({
      name: "channel",
      description: "The voice channel to use as waiting room",
      required: true,
      type: ApplicationCommandOptionType.Channel,
      channelTypes: [ChannelType.GuildVoice],
    })
    channel: VoiceChannel,
    interaction: CommandInteraction,
  ): Promise<void> {
    logger.info(`Command 'waiting-room' triggered by ${interaction.user.username} (${interaction.user.id}) for queue '${name}'`)

    if (!interaction.guild) return

    try {
      await this.queueManager.setWaitingRoom(interaction.guild.id, name, channel.id)
      logger.info(`Waiting room for queue '${name}' set to channel '${channel.name}' (${channel.id}) in guild '${interaction.guild.name}' (${interaction.guild.id})`)

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Waiting Room Set")
            .setDescription(`Waiting room for queue **${name}** set to <#${channel.id}>.`)
            .setColor(Colors.Green),
        ],
        flags: MessageFlags.Ephemeral,
      })
    } catch (error: unknown) {
      let errorMessage = "Failed to set waiting room."
      if (error instanceof QueueNotFoundError) {
        errorMessage = `Queue **${name}** not found.`
        logger.warn(`Failed to set waiting room: Queue '${name}' not found in guild '${interaction.guild.id}'`)
      } else {
        logger.error(`Error setting waiting room for queue '${name}':`, error)
      }

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Error")
            .setDescription(errorMessage)
            .setColor(Colors.Red),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }
  }
}
