import { CommandInteraction, EmbedBuilder, Colors, MessageFlags } from "discord.js"
import { Discord, Slash, SlashGroup } from "discordx"
import { QueueManager } from "@managers/QueueManager"
import { inject, injectable } from "tsyringe"
import { queueCommands } from "@config/messages"

@Discord()
@injectable()
@SlashGroup({ name: "queue", description: queueCommands.summary.groupDescription })
export class QueueSummaryCommand {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager,
  ) { }

  @Slash({ name: "summary", description: queueCommands.summary.description, dmPermission: false })
  @SlashGroup("queue")
  async summary(interaction: CommandInteraction) {
    if (!interaction.guildId) return

    await interaction.deferReply({ flags: MessageFlags.Ephemeral })

    try {
      const queue = await this.queueManager.getQueueByUser(interaction.guildId, interaction.user.id)

      if (!queue) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle(queueCommands.summary.notInQueue.title)
              .setDescription(queueCommands.summary.notInQueue.description)
              .setColor(Colors.Red),
          ],
        })
        return
      }

      const position = await this.queueManager.getQueuePosition(queue.id, interaction.user.id)
      const members = await this.queueManager.getQueueMembers(interaction.guildId, queue.name)
      const memberCount = members.length

      const member = await this.queueManager.getQueueMember(queue.id, interaction.user.id)

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(queueCommands.summary.summaryTitle(queue.name))
            .setDescription(queue.description)
            .addFields(
              { name: queueCommands.summary.fields.totalEntries, value: String(memberCount), inline: true },
              { name: queueCommands.summary.fields.yourPosition, value: String(position), inline: true },
              { name: queueCommands.summary.fields.joined, value: `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>`, inline: true },
            )
            .setColor(Colors.Blue)
            .setTimestamp(),
        ],
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : queueCommands.summary.errors.default
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(queueCommands.summary.errors.title)
            .setDescription(message)
            .setColor(Colors.Red),
        ],
      })
    }
  }
}
