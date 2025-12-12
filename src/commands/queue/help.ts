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
import { queueCommands } from "@config/messages"

@Discord()
@injectable()
@SlashGroup("queue")
export class QueueHelp {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager,
  ) { }

  @Slash({ name: "help", description: queueCommands.help.description, dmPermission: false })
  async help(
    @SlashOption({
      name: "queue",
      description: queueCommands.help.optionQueue,
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
        .setTitle(queueCommands.help.embed.title)
        .setDescription(queueCommands.help.embed.description)
        .setColor(Colors.Blue)
        .addFields(
          {
            name: queueCommands.help.embed.fields.join.name,
            value: queueCommands.help.embed.fields.join.value,
            inline: false,
          },
          {
            name: queueCommands.help.embed.fields.leave.name,
            value: queueCommands.help.embed.fields.leave.value,
            inline: false,
          },
          {
            name: queueCommands.help.embed.fields.list.name,
            value: queueCommands.help.embed.fields.list.value,
            inline: false,
          },
          {
            name: queueCommands.help.embed.fields.summary.name,
            value: queueCommands.help.embed.fields.summary.value,
            inline: false,
          },
        )

      // Check if queue has waiting room configured
      try {
        const queue = await this.queueManager.resolveQueue(interaction.guild.id, queueName)
        if (queue.waitingRoomId) {
          const waitingRoomChannel = await interaction.guild.channels.fetch(queue.waitingRoomId)
          if (waitingRoomChannel) {
            const field = queueCommands.help.embed.fields.waitingRoom(queue.name, queue.waitingRoomId)
            embed.addFields({
              name: field.name,
              value: field.value,
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
            .setTitle(queueCommands.help.errors.title)
            .setDescription(queueCommands.help.errors.description)
            .setColor(Colors.Red),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }
  }
}
