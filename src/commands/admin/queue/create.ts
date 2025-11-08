import { ApplicationCommandOptionType, Colors, CommandInteraction, EmbedBuilder, MessageFlags } from "discord.js"
import { Discord, Slash, SlashGroup, SlashOption } from "discordx"
import db, { queues } from "../../../db"

@Discord()
@SlashGroup({
  name: "admin",
  description: "Admin commands",
})
@SlashGroup({
  name: "queue",
  description: "Queue management commands",
  root: "admin",
})
export class AdminQueueCreate {
  @Slash({
    name: "create",
    description: "Create a new queue",
  })
  @SlashGroup("queue", "admin")
  async create(
    @SlashOption({
      name: "name",
      description: "The name of the queue",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    name: string,
    @SlashOption({
      name: "description",
      description: "The description of the queue",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    description: string,
    interaction: CommandInteraction,
  ): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        ephemeral: true,
      })
      return
    }

    // TODO: log queue creation
    try {
      const newQueue = await db.insert(queues).values({
        guildId: interaction.guild.id,
        name: name,
        description: description,
      }).returning()
      // TODO: log queue creation end
      await interaction.reply({
        embeds: [this.createQueueEmbed(newQueue[0].name, newQueue[0].description)],
        flags: MessageFlags.Ephemeral,
      })
    } catch (error) {
      await interaction.reply({
        content: `Failed to create queue: ${error}`,
        flags: MessageFlags.Ephemeral,
      })
      return
    }
  }

  private createQueueEmbed(queueName: string, description: string): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle("Queue Created")
      .setDescription(`Queue "${queueName}" with description "${description}" created.`)
      .setColor(Colors.Green)
    return embed
  }
}
