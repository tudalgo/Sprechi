import {
  ApplicationCommandOptionType,
  CommandInteraction,
  GuildMember,
  EmbedBuilder,
  Colors,
  MessageFlags,
  VoiceChannel,
  User,
} from "discord.js"
import { Discord, Slash, SlashGroup, SlashOption } from "discordx"
import { RoomManager } from "@managers/RoomManager"
import { inject, injectable } from "tsyringe"
import logger from "@utils/logger"
import { tutorVoiceCommands } from "@config/messages"

@Discord()
@injectable()
@SlashGroup("voice", "tutor")
export class TutorVoiceKick {
  constructor(
    @inject(RoomManager) private roomManager: RoomManager,
  ) { }

  @Slash({ name: "kick", description: tutorVoiceCommands.kick.description, dmPermission: false })
  async kick(
    @SlashOption({
      name: "user",
      description: tutorVoiceCommands.kick.optionUser,
      required: true,
      type: ApplicationCommandOptionType.User,
    })
    user: User,
    interaction: CommandInteraction,
  ): Promise<void> {
    logger.info(`Command 'tutor voice kick' triggered by ${interaction.user.username} (${interaction.user.id}) targeting ${user.username} (${user.id})`)

    if (!interaction.guild) return

    const member = interaction.member as GuildMember
    const channel = member.voice.channel as VoiceChannel

    if (!channel) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(tutorVoiceCommands.kick.errors.title)
            .setDescription(tutorVoiceCommands.kick.errors.missingVoiceChannel)
            .setColor(Colors.Red),
        ],
        flags: MessageFlags.Ephemeral,
      })
      return
    }

    const targetMember = channel.members.get(user.id)
    if (!targetMember) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(tutorVoiceCommands.kick.errors.title)
            .setDescription(tutorVoiceCommands.kick.errors.userNotInChannel)
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
            .setTitle(tutorVoiceCommands.kick.errors.title)
            .setDescription(tutorVoiceCommands.kick.errors.nonEphemeralChannel)
            .setColor(Colors.Red),
        ],
        flags: MessageFlags.Ephemeral,
      })
      return
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral })

    try {
      await this.roomManager.kickUser(channel, user.id)

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(tutorVoiceCommands.kick.success.title)
            .setDescription(tutorVoiceCommands.kick.success.description(user.displayName, channel.name))
            .setColor(Colors.Green),
        ],
      })
    } catch (error) {
      logger.error(`Failed to kick user ${user.id} from channel ${channel.id}:`, error)
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(tutorVoiceCommands.kick.errors.title)
            .setDescription(tutorVoiceCommands.kick.errors.description)
            .setColor(Colors.Red),
        ],
      })
    }
  }
}
