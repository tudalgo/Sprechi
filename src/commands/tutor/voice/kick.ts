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

@Discord()
@injectable()
@SlashGroup("voice", "tutor")
export class TutorVoiceKick {
  constructor(
    @inject(RoomManager) private roomManager: RoomManager
  ) { }

  @Slash({ name: "kick", description: "Kick a user from the current voice channel" })
  async kick(
    @SlashOption({
      name: "user",
      description: "The user to kick",
      required: true,
      type: ApplicationCommandOptionType.User,
    })
    user: User,
    interaction: CommandInteraction,
  ): Promise<void> {
    logger.info(`Command 'tutor voice kick' triggered by ${interaction.user.username} (${interaction.user.id}) targeting ${user.username} (${user.id})`)

    if (!interaction.guild) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        flags: MessageFlags.Ephemeral,
      })
      return
    }

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

    const targetMember = channel.members.get(user.id)
    if (!targetMember) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Error")
            .setDescription("The specified user is not in your voice channel.")
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
      await this.roomManager.kickUser(channel, user.id)

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("User Kicked")
            .setDescription(`Kicked **${user.displayName}** from **${channel.name}**.`)
            .setColor(Colors.Green),
        ],
      })
    } catch (error) {
      logger.error(`Failed to kick user ${user.id} from channel ${channel.id}:`, error)
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Error")
            .setDescription("Failed to kick the user.")
            .setColor(Colors.Red),
        ],
      })
    }
  }
}
