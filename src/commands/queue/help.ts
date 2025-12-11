import {
  ApplicationCommandOptionType,
  CommandInteraction,
  EmbedBuilder,
  Colors,
  MessageFlags,
} from "discord.js"
import { Discord, Slash, SlashGroup, SlashOption } from "discordx"
import { QueueManager } from "@managers/QueueManager"
import logger from "@utils/logger"
import { inject, injectable } from "tsyringe"

@Discord()
@injectable()
@SlashGroup("queue")
export class QueueHelp {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager,
  ) { }

  @Slash({ name: "help", description: "Get help with queue commands", dmPermission: false })
  async help(
    @SlashOption({
      name: "queue",
      description: "The name of the queue to get waiting room info for (optional)",
      required: false,
      type: ApplicationCommandOptionType.String,
    })
    queueName: string | undefined,
    interaction: CommandInteraction,
  ): Promise<void> {
    logger.info(`Command 'queue help' triggered by ${interaction.user.username} (${interaction.user.id})`)

    if (!interaction.guild) return

    try {
      const embed = new EmbedBuilder()
        .setTitle("📚 Queue Help - Student Commands")
        .setDescription("Here are the available commands for managing your queue membership:")
        .setColor(Colors.Blue)
        .addFields(
          {
            name: "📝 Join a Queue",
            value: "`/queue join [name]`\nJoin a queue. If no name is provided, you'll join the default queue.",
            inline: false,
          },
          {
            name: "🚪 Leave a Queue",
            value: "`/queue leave`\nLeave the queue you're currently in.",
            inline: false,
          },
          {
            name: "📋 List Queues",
            value: "`/queue list`\nView all available queues and their current status.",
            inline: false,
          },
          {
            name: "📊 Queue Summary",
            value: "`/queue summary [name]`\nView detailed information about a specific queue, including members and wait times.",
            inline: false,
          },
        )

      // Check if queue has waiting room configured
      try {
        const queue = await this.queueManager.resolveQueue(interaction.guild.id, queueName)
        if (queue.waitingRoomId) {
          const waitingRoomChannel = await interaction.guild.channels.fetch(queue.waitingRoomId)
          if (waitingRoomChannel) {
            embed.addFields({
              name: "🎤 Waiting Room",
              value: `You can also join the queue **${queue.name}** by joining the waiting room voice channel: <#${queue.waitingRoomId}>`,
              inline: false,
            })
          }
        }
      } catch {
        // If queue resolution fails, just don't show waiting room info
        // This is not an error, just means no waiting room is configured
      }

      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      })
    } catch (error) {
      logger.error("Error displaying queue help:", error)
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Error")
            .setDescription("Failed to display help information.")
            .setColor(Colors.Red),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }
  }
}
