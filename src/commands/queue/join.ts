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
  QueueLockedError,
  AlreadyInQueueError,
  QueueError,
} from "../../errors/QueueErrors"

@Discord()
@SlashGroup("queue")
export class QueueJoin {
  private queueManager = new QueueManager()

  @Slash({ name: "join", description: "Join a queue" })
  async join(
    @SlashOption({
      name: "name",
      description: "The name of the queue to join",
      required: false,
      type: ApplicationCommandOptionType.String,
    })
    name: string | undefined,
    interaction: CommandInteraction,
  ): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        flags: MessageFlags.Ephemeral,
      })
      return
    }

    try {
      const queue = await this.queueManager.resolveQueue(interaction.guild.id, name)
      await this.queueManager.joinQueue(interaction.guild.id, queue.name, interaction.user.id)

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Joined Queue")
            .setDescription(`You have joined the queue **${queue.name}**.`)
            .setColor(Colors.Green),
        ],
        flags: MessageFlags.Ephemeral,
      })
    } catch (error: any) {
      let errorMessage = "Failed to join queue."
      if (error instanceof QueueNotFoundError) {
        errorMessage = `Queue **${name}** not found.`
      } else if (error instanceof QueueLockedError) {
        errorMessage = `Queue **${name}** is locked.`
      } else if (error instanceof AlreadyInQueueError) {
        errorMessage = `You are already in queue **${name}**.`
      } else if (error instanceof QueueError) {
        errorMessage = error.message
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
