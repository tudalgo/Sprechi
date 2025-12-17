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
import { tutorVoiceCommands } from "@config/messages"

@Discord()
@injectable()
@SlashGroup({ name: "voice", description: "Manage voice channels", root: "tutor" })
@SlashGroup("voice", "tutor")
export class TutorVoiceClose {
  constructor(
    @inject(RoomManager) private roomManager: RoomManager,
  ) { }

  @Slash({ name: "close", description: tutorVoiceCommands.close.description, dmPermission: false })
  async close(interaction: CommandInteraction): Promise<void> {
    logger.info(`Command 'tutor voice close' triggered by ${interaction.user.username} (${interaction.user.id})`)

    if (!interaction.guild) return

    const member = interaction.member as GuildMember
    const channel = member.voice.channel as VoiceChannel

    if (!channel) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(tutorVoiceCommands.close.errors.title)
            .setDescription(tutorVoiceCommands.close.errors.missingVoiceChannel)
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
            .setTitle(tutorVoiceCommands.close.errors.title)
            .setDescription(tutorVoiceCommands.close.errors.nonEphemeralChannel)
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
            .setTitle(tutorVoiceCommands.close.success.title)
            .setDescription(tutorVoiceCommands.close.success.description(channel.name))
            .setColor(Colors.Green),
        ],
      })
    } catch (error) {
      logger.error(`Failed to close channel ${channel.id}:`, error)
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(tutorVoiceCommands.close.errors.title)
            .setDescription(tutorVoiceCommands.close.errors.description)
            .setColor(Colors.Red),
        ],
      })
    }
  }
}
