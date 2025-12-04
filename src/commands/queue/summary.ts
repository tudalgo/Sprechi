import { CommandInteraction, EmbedBuilder, Colors, MessageFlags } from "discord.js"
import { Discord, Slash, SlashGroup } from "discordx"
import { QueueManager } from "@managers/QueueManager"
import { inject, injectable } from "tsyringe"

@Discord()
@injectable()
@SlashGroup({ name: "queue", description: "Manage queues" })
export class QueueSummaryCommand {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager
  ) { }

  @Slash({ name: "summary", description: "Show summary of your current queue" })
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
              .setTitle("Not in Queue")
              .setDescription("You are not currently in any queue.")
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
            .setTitle(`Queue Summary: ${queue.name}`)
            .setDescription(queue.description)
            .addFields(
              { name: "Total Entries", value: String(memberCount), inline: true },
              { name: "Your Position", value: String(position), inline: true },
              { name: "Joined", value: `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>`, inline: true },
            )
            .setColor(Colors.Blue)
            .setTimestamp(),
        ],
      })
    } catch (error: any) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Error")
            .setDescription(error.message || "An error occurred while fetching queue summary.")
            .setColor(Colors.Red),
        ],
      })
    }
  }
}
