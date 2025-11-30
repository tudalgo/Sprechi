import {
  ApplicationCommandOptionType,
  CommandInteraction,
  EmbedBuilder,
  Colors,
  MessageFlags,
} from "discord.js"
import { Discord, Slash, SlashGroup, SlashOption } from "discordx"
import { QueueManager } from "@managers/QueueManager"
import {
  QueueNotFoundError,
  SessionAlreadyActiveError,
  QueueError,
} from "../../../errors/QueueErrors"
import logger from "@utils/logger"

@Discord()
@SlashGroup("session", "tutor")
export class TutorSessionStart {
  private queueManager = new QueueManager()

  @Slash({ name: "start", description: "Start a tutoring session" })
  async start(
    @SlashOption({
      name: "queue",
      description: "The name of the queue (optional)",
      required: false,
      type: ApplicationCommandOptionType.String,
    })
    name: string | undefined,
    interaction: CommandInteraction,
  ): Promise<void> {
    logger.info(`Command 'tutor session start' triggered by ${interaction.user.tag} (${interaction.user.id}) for queue '${name ?? "auto-detect"}'`)

    if (!interaction.guild) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        flags: MessageFlags.Ephemeral,
      })
      return
    }

    try {
      const queue = await this.queueManager.resolveQueue(interaction.guild.id, name)
      await this.queueManager.createSession(interaction.guild.id, queue.name, interaction.user.id)

      logger.info(`Tutor ${interaction.user.tag} started session on queue '${queue.name}' in guild '${interaction.guild.name}' (${interaction.guild.id})`)

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Session Started")
            .setDescription(`You have started a session on queue **${queue.name}**.`)
            .setColor(Colors.Green),
        ],
        flags: MessageFlags.Ephemeral,
      })
    } catch (error: unknown) {
      let errorMessage = "Failed to start session."
      if (error instanceof QueueNotFoundError) {
        errorMessage = `Queue **${name}** not found.`
        logger.warn(`Failed to start session: Queue '${name}' not found in guild '${interaction.guild.id}'`)
      } else if (error instanceof SessionAlreadyActiveError) {
        errorMessage = "You already have an active session."
        logger.warn(`Failed to start session: Tutor ${interaction.user.tag} already has an active session in guild '${interaction.guild.id}'`)
      } else if (error instanceof QueueError) {
        errorMessage = error.message
        logger.warn(`Failed to start session for tutor ${interaction.user.tag}: ${error.message}`)
      } else {
        logger.error(`Error starting session for tutor ${interaction.user.tag}:`, error)
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
