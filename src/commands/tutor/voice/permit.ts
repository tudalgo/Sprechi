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
import { QueueManager } from "@managers/QueueManager"
import { tutorVoiceCommands } from "@config/messages"

@Discord()
@injectable()
@SlashGroup("voice", "tutor")
export class TutorVoicePermit {
  constructor(
    @inject(RoomManager) private roomManager: RoomManager,
    @inject(QueueManager) private queueManager: QueueManager,
  ) { }

  @Slash({ name: "permit", description: tutorVoiceCommands.permit.description, dmPermission: false })
  async permit(
    @SlashOption({
      name: "user",
      description: tutorVoiceCommands.permit.optionUser,
      required: true,
      type: ApplicationCommandOptionType.User,
    })
    user: User,
    interaction: CommandInteraction,
  ): Promise<void> {
    logger.info(`Command 'tutor voice permit' triggered by ${interaction.user.username} (${interaction.user.id}) targeting ${user.username} (${user.id})`)

    if (!interaction.guild) return

    const member = interaction.member as GuildMember
    const channel = member.voice.channel as VoiceChannel

    if (!channel) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(tutorVoiceCommands.permit.errors.title)
            .setDescription(tutorVoiceCommands.permit.errors.missingVoiceChannel)
            .setColor(Colors.Red),
        ],
        flags: MessageFlags.Ephemeral,
      })
      return
    }

    // Check if channel is ephemeral.
    const isEphemeral = await this.roomManager.isEphemeralChannel(channel.id)
    if (!isEphemeral) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(tutorVoiceCommands.permit.errors.title)
            .setDescription(tutorVoiceCommands.permit.errors.nonEphemeralChannel)
            .setColor(Colors.Red),
        ],
        flags: MessageFlags.Ephemeral,
      })
      return
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral })

    try {
      // Check if user is in a queue
      const queue = await this.queueManager.getQueueByUser(interaction.guild!.id, user.id)
      const sessionId = await this.roomManager.getSessionIdFromChannel(channel.id)

      const success = await this.roomManager.permitUser(channel, user.id)

      if (success) {
        let description = tutorVoiceCommands.permit.success.description(user.displayName, channel.name)

        if (queue && sessionId) {
          // Treated as a pick
          try {
            await this.queueManager.pickStudent(
              interaction.guild!.id,
              queue.name,
              user.id,
              sessionId,
              interaction.user.id,
              channel.id,
            )
            description += `\n${tutorVoiceCommands.permit.success.queuePickSuffix(queue.name)}`
          } catch (err) {
            logger.warn(`Failed to pick permitted user ${user.id} from queue:`, err)
          }
        }

        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle(tutorVoiceCommands.permit.success.title)
              .setDescription(description)
              .setColor(Colors.Green),
          ],
        })
      } else {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle(tutorVoiceCommands.permit.errors.title)
              .setDescription(tutorVoiceCommands.permit.errors.description)
              .setColor(Colors.Red),
          ],
        })
      }
    } catch (error) {
      logger.error(`Failed to permit user ${user.id} to channel ${channel.id}:`, error)
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(tutorVoiceCommands.permit.errors.title)
            .setDescription(tutorVoiceCommands.permit.errors.description)
            .setColor(Colors.Red),
        ],
      })
    }
  }
}
