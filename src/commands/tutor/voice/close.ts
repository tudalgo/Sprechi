import {
  CommandInteraction,
  GuildMember,
  EmbedBuilder,
  Colors,
  MessageFlags,
  VoiceChannel,
} from "discord.js"
import { Discord, Slash, SlashGroup } from "discordx"
import { RoomManager } from "@managers/RoomManager"
import { inject, injectable } from "tsyringe"
import logger from "@utils/logger"

@Discord()
@injectable()
@SlashGroup({ name: "voice", description: "Manage voice channels", root: "tutor" })
@SlashGroup("voice", "tutor")
export class TutorVoiceClose {
  constructor(
    @inject(RoomManager) private roomManager: RoomManager,
  ) { }

  @Slash({ name: "close", description: "Close the current temporary voice channel", dmPermission: false })
  async close(interaction: CommandInteraction): Promise<void> {
    logger.info(`Command 'tutor voice close' triggered by ${interaction.user.username} (${interaction.user.id})`)

    if (!interaction.guild) return

    const member = interaction.member as GuildMember
    const channel = member.voice.channel as VoiceChannel

    if (!channel) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Error")
            .setDescription("You must be in a voice channel to use this command.")
            .setColor(Colors.Red),
        ],
        flags: MessageFlags.Ephemeral,
      })
      return
    }

    const isEphemeral = await this.roomManager.isEphemeralChannel(channel.id)
    if (!isEphemeral) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Error")
            .setDescription("This command can only be used in a temporary Tutor voice channel.")
            .setColor(Colors.Red),
        ],
        flags: MessageFlags.Ephemeral,
      })
      return
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral })

    try {
      await this.roomManager.kickAllMembers(channel)
      await this.roomManager.deleteChannel(channel)

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Channel Closed")
            .setDescription(`Voice channel **${channel.name}** has been closed.`)
            .setColor(Colors.Green),
        ],
      })
    } catch (error) {
      logger.error(`Failed to close channel ${channel.id}:`, error)
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Error")
            .setDescription("Failed to close the channel.")
            .setColor(Colors.Red),
        ],
      })
    }
  }
}
