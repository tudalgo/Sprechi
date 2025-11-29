import {
    CommandInteraction,
    EmbedBuilder,
    Colors,
    MessageFlags,
} from "discord.js"
import { Discord, Slash, SlashGroup } from "discordx"
import { QueueManager } from "@managers/QueueManager"
import { RoomManager } from "@managers/RoomManager"
import { QueueError } from "@errors/QueueErrors"

@Discord()
@SlashGroup({ name: "tutor", description: "Tutor commands" })
@SlashGroup({ name: "queue", description: "Queue management", root: "tutor" })
export class TutorQueue {
    private queueManager = new QueueManager()
    private roomManager = new RoomManager()

    @Slash({ name: "list", description: "List members in the active session's queue" })
    @SlashGroup("queue", "tutor")
    async list(interaction: CommandInteraction): Promise<void> {
        if (!interaction.guild) return

        try {
            const activeSession = await this.queueManager.getActiveSession(interaction.guild.id, interaction.user.id)
            if (!activeSession) {
                throw new QueueError("You do not have an active session.")
            }

            const { queue } = activeSession
            const members = await this.queueManager.getQueueMembers(interaction.guild.id, queue.name)

            if (members.length === 0) {
                await interaction.reply({
                    content: `The queue **${queue.name}** is empty.`,
                    flags: MessageFlags.Ephemeral,
                })
                return
            }

            const embed = new EmbedBuilder()
                .setTitle(`Queue: ${queue.name}`)
                .setDescription(members.map((m, i) => `${i + 1}. <@${m.userId}>`).join("\n"))
                .setColor(Colors.Blue)
                .setFooter({ text: `Total: ${members.length}` })

            await interaction.reply({
                embeds: [embed],
                flags: MessageFlags.Ephemeral,
            })
        } catch (error: any) {
            await interaction.reply({
                content: error.message || "An error occurred.",
                flags: MessageFlags.Ephemeral,
            })
        }
    }

    @Slash({ name: "next", description: "Pick the next student from the queue" })
    @SlashGroup("queue", "tutor")
    async next(interaction: CommandInteraction): Promise<void> {
        if (!interaction.guild) return

        await interaction.deferReply({ flags: MessageFlags.Ephemeral })

        try {
            const activeSession = await this.queueManager.getActiveSession(interaction.guild.id, interaction.user.id)
            if (!activeSession) {
                throw new QueueError("You do not have an active session.")
            }

            const { queue, session } = activeSession
            const members = await this.queueManager.getQueueMembers(interaction.guild.id, queue.name)

            if (members.length === 0) {
                await interaction.editReply("The queue is empty.")
                return
            }

            const nextMember = members[0]
            const studentId = nextMember.userId
            const tutorId = interaction.user.id

            // Create ephemeral channel
            const channelName = `Session-${interaction.user.username}`
            const channel = await this.roomManager.createEphemeralChannel(
                interaction.guild,
                channelName,
                [tutorId, studentId],
                // We could pass a category ID here if configured
            )

            if (!channel) {
                throw new QueueError("Failed to create session room.")
            }

            // Move tutor
            const tutorMember = await interaction.guild.members.fetch(tutorId)
            if (tutorMember.voice.channel) {
                await tutorMember.voice.setChannel(channel)
            }

            // Use pickStudent to remove from queue, record session student, log, and DM
            await this.queueManager.pickStudent(
                interaction.guild.id,
                queue.name,
                studentId,
                session.id,
                tutorId,
                channel.id,
                channelName
            )

            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Student Picked")
                        .setDescription(`Picked <@${studentId}>. Created room <#${channel.id}>.`)
                        .setColor(Colors.Green),
                ],
            })

        } catch (error: any) {
            await interaction.editReply(error.message || "An error occurred.")
        }
    }
}
