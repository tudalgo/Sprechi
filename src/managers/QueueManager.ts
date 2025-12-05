import db, { InternalRole } from "@db"
import { queues, queueMembers, sessions, sessionStudents } from "@db/schema"
import logger from "@utils/logger"
import { eq, and, sql, isNull } from "drizzle-orm"
import {
  QueueNotFoundError,
  QueueLockedError,
  AlreadyInQueueError,
  NotInQueueError,
  SessionAlreadyActiveError,
  TutorCannotJoinQueueError,
  StudentCannotStartSessionError,
  QueueError,
} from "../errors/QueueErrors"
import { bot } from "../bot"
import { EmbedBuilder, Colors, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, CommandInteraction } from "discord.js"
import { RoomManager } from "./RoomManager"
import { GuildManager } from "./GuildManager"
import { inject } from "tsyringe"

export interface QueueData {
  guildId: string
  name: string
  description: string
}

import { singleton } from "tsyringe"

@singleton()
export class QueueManager {
  constructor(
    @inject(GuildManager) private guildManager: GuildManager,
  ) { }

  async createQueue(data: QueueData & { isLocked?: boolean }) {
    const [newQueue] = await db.insert(queues)
      .values({
        guildId: data.guildId,
        name: data.name,
        description: data.description,
        isLocked: data.isLocked ?? false,
      })
      .returning()
    logger.info(`[New Queue] Created queue "${data.name}" in guild ${data.guildId}.`)
    return newQueue
  }

  async getQueueByName(guildId: string, name: string) {
    const [queue] = await db.select()
      .from(queues)
      .where(and(eq(queues.guildId, guildId), eq(queues.name, name)))
    return queue ?? null
  }

  async listQueues(guildId: string) {
    const result = await db.select({
      queue: queues,
      memberCount: sql<number>`count(${queueMembers.id}) filter (where ${queueMembers.leftAt} is null)`,
      sessionCount: sql<number>`count(${sessions.id}) filter (where ${sessions.endTime} is null)`,
    })
      .from(queues)
      .leftJoin(queueMembers, eq(queues.id, queueMembers.queueId))
      .leftJoin(sessions, eq(queues.id, sessions.queueId))
      .where(eq(queues.guildId, guildId))
      .groupBy(queues.id)

    return result.map(({ queue, memberCount, sessionCount }) => ({
      ...queue,
      memberCount: Number(memberCount),
      sessionCount: Number(sessionCount),
    }))
  }

  async deleteQueue(guildId: string, name: string) {
    const deleted = await db.delete(queues)
      .where(and(eq(queues.guildId, guildId), eq(queues.name, name)))
      .returning()
    if (deleted.length > 0) {
      logger.info(`[Delete Queue] Deleted queue "${name}" in guild ${guildId}.`)
    }
    return deleted.length > 0
  }

  async joinQueue(guildId: string, queueName: string, userId: string) {
    const queue = await this.getQueueByName(guildId, queueName)
    if (!queue) {
      throw new QueueNotFoundError(queueName)
    }

    if (queue.isLocked) {
      throw new QueueLockedError(queueName)
    }

    // Check if user has an active session as a tutor
    const activeSession = await this.getActiveSession(guildId, userId)
    if (activeSession) {
      throw new TutorCannotJoinQueueError()
    }

    // Check if user is already in queue
    const [existingMember] = await db.select()
      .from(queueMembers)
      .where(and(eq(queueMembers.queueId, queue.id), eq(queueMembers.userId, userId)))

    if (existingMember) {
      if (!existingMember.leftAt) {
        throw new AlreadyInQueueError(queueName)
      }

      // Rejoin logic
      const leftAt = new Date(existingMember.leftAt)
      const now = new Date()
      const diff = now.getTime() - leftAt.getTime()

      if (diff < 60000) {
        // Within grace period, restore position
        await db.update(queueMembers)
          .set({ leftAt: null })
          .where(eq(queueMembers.id, existingMember.id))

        await this.logToChannel(queue, `User <@${userId}> rejoined the queue (restored position).`)
        await this.sendJoinDm(queue, userId)
        logger.info(`[Rejoin Queue] User ${userId} rejoined queue "${queue.name}" (${queue.id}) in guild ${guildId} (restored position).`)
        return
      } else {
        // Grace period expired, treat as new join
        await db.delete(queueMembers).where(eq(queueMembers.id, existingMember.id))
      }
    }

    await db.insert(queueMembers).values({
      queueId: queue.id,
      userId,
    })

    await this.logToChannel(queue, `User <@${userId}> joined the queue.`)
    await this.sendJoinDm(queue, userId)
    logger.info(`[Join Queue] User ${userId} joined queue "${queue.name}" (${queue.id}) in guild ${guildId}.`)
  }

  private async sendJoinDm(queue: typeof queues.$inferSelect, userId: string) {
    try {
      const user = await bot.users.fetch(userId)
      const position = await this.getQueuePosition(queue.id, userId)

      const member = await this.getQueueMember(queue.id, userId)

      const embed = new EmbedBuilder()
        .setTitle(`Joined Queue: ${queue.name}`)
        .setDescription(`You have joined the queue **${queue.name}**.\n\n**Position:** ${position}\n**Joined:** <t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>`)
        .setColor(Colors.Green)
        .setTimestamp()

      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`queue_refresh_${queue.id}`)
            .setLabel("Refresh Status")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`queue_leave_${queue.id}`)
            .setLabel("Leave Queue")
            .setStyle(ButtonStyle.Danger),
        )

      await user.send({ embeds: [embed], components: [row] })
    } catch (error) {
      logger.error(`Failed to DM user ${userId} after joining queue:`, error)
    }
  }

  async leaveQueue(guildId: string, queueName: string, userId: string) {
    const queue = await this.getQueueByName(guildId, queueName)
    if (!queue) {
      throw new QueueNotFoundError(queueName)
    }

    const [member] = await db.select()
      .from(queueMembers)
      .where(and(eq(queueMembers.queueId, queue.id), eq(queueMembers.userId, userId), isNull(queueMembers.leftAt)))

    if (!member) {
      throw new NotInQueueError(queueName)
    }

    await db.update(queueMembers)
      .set({ leftAt: new Date() })
      .where(eq(queueMembers.id, member.id))

    await this.logToChannel(queue, `User <@${userId}> left the queue (grace period started).`)
    logger.info(`[Leave Queue] User ${userId} left queue "${queue.name}" (${queue.id}) in guild ${guildId}`)

    // Remove from waiting room voice channel
    if (queue.waitingRoomId) {
      try {
        const guild = await bot.guilds.fetch(guildId)
        const member = await guild.members.fetch(userId)
        if (member.voice.channelId === queue.waitingRoomId) {
          await member.voice.disconnect("Left the queue")
        }
      } catch (error) {
        logger.error(`Failed to disconnect user ${userId} from waiting room:`, error)
      }
    }

    // DM User with Rejoin button
    try {
      const user = await bot.users.fetch(userId)
      const embed = new EmbedBuilder()
        .setTitle("Left Queue")
        .setDescription(`You have left the queue **${queue.name}**.\n\nYou have **1 minute** to rejoin without losing your spot.`)
        .setColor(Colors.Yellow)
        .setTimestamp()

      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`queue_rejoin_${queue.id}`)
            .setLabel("Rejoin Queue")
            .setStyle(ButtonStyle.Success),
        )

      await user.send({ embeds: [embed], components: [row] })
    } catch (error) {
      logger.error(`Failed to DM user ${userId} after leaving queue:`, error)
    }

    // Schedule cleanup
    setTimeout(async () => {
      try {
        const [currentMember] = await db.select()
          .from(queueMembers)
          .where(eq(queueMembers.id, member.id))

        if (currentMember && currentMember.leftAt) {
          const diff = new Date().getTime() - new Date(currentMember.leftAt).getTime()
          if (diff >= 60000) {
            await db.delete(queueMembers).where(eq(queueMembers.id, member.id))

            await this.logToChannel(queue, `User <@${userId}> left the queue.`)
          }
        }
      } catch (error) {
        logger.error("Error in queue leave cleanup:", error)
      }
    }, 60000)
  }

  async getActiveSession(guildId: string, tutorId: string) {
    const [session] = await db.select({
      session: sessions,
      queue: queues,
    })
      .from(sessions)
      .innerJoin(queues, eq(sessions.queueId, queues.id))
      .where(and(
        eq(queues.guildId, guildId),
        eq(sessions.tutorId, tutorId),
        isNull(sessions.endTime),
      ))

    return session ?? null
  }

  async pickStudent(guildId: string, queueName: string, userId: string, sessionId: string, tutorId: string, channelId: string) {
    const queue = await this.getQueueByName(guildId, queueName)
    if (!queue) {
      throw new QueueNotFoundError(queueName)
    }

    // Remove from queue immediately (no grace period)
    await db.delete(queueMembers)
      .where(and(eq(queueMembers.queueId, queue.id), eq(queueMembers.userId, userId)))

    // Create session student record
    await db.insert(sessionStudents).values({
      sessionId,
      studentId: userId,
      channelId,
    })

    await this.logToChannel(queue, `User <@${userId}> was picked by <@${tutorId}>.`)
    logger.info(`[Pick Student] Tutor ${tutorId} picked student ${userId} from queue "${queue.name}" (${queue.id}). Session: ${sessionId}`)

    // DM Student
    try {
      const user = await bot.users.fetch(userId)
      await user.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("You have been picked!")
            .setDescription(`You have been picked by <@${tutorId}> for a tutoring session.\nPlease join the voice channel: <#${channelId}>`)
            .setColor(Colors.Green),
        ],
      })
    } catch (error) {
      logger.error(`Failed to DM user ${userId} after being picked:`, error)
    }
  }

  async getQueueMembers(guildId: string, queueName: string, limit?: number) {
    const queue = await this.getQueueByName(guildId, queueName)
    if (!queue) {
      throw new QueueNotFoundError(queueName)
    }

    const base = db.select()
      .from(queueMembers)
      .where(and(eq(queueMembers.queueId, queue.id), isNull(queueMembers.leftAt)))
      .orderBy(queueMembers.joinedAt)

    const query = limit ? base.limit(limit) : base

    return query
  }

  async processStudentPick(
    interaction: CommandInteraction,
    roomManager: RoomManager,
    queue: { name: string, waitingRoomId: string | null },
    session: { id: string },
    studentId: string,
    tutorId: string,
  ) {
    // Get waiting room category
    let categoryId: string | undefined
    if (queue.waitingRoomId) {
      try {
        const waitingChannel = await interaction.guild?.channels.fetch(queue.waitingRoomId)
        if (waitingChannel && waitingChannel.parentId) {
          categoryId = waitingChannel.parentId
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "An error occurred."
        logger.error(`Failed to fetch waiting room category: ${message}`)
      }
    }

    // Create ephemeral channel
    const channelName = `Session-${interaction.user.displayName}`
    const channel = await roomManager.createEphemeralChannel(
      interaction.guild!,
      channelName,
      [tutorId, studentId],
      categoryId,
    )

    if (!channel) {
      throw new QueueError("Failed to create session room.")
    }

    // Move tutor
    try {
      const tutorMember = await interaction.guild?.members.fetch(tutorId)
      if (tutorMember?.voice.channel) {
        await tutorMember.voice.setChannel(channel)
      }
    } catch (error) {
      logger.warn(`Failed to move tutor ${tutorId} to channel ${channel.id}: ${error}`)
    }

    // Use pickStudent to remove from queue, record session student, log, and DM
    await this.pickStudent(
      interaction.guild!.id,
      queue.name,
      studentId,
      session.id,
      tutorId,
      channel.id,
    )

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle("Student Picked")
          .setDescription(`Picked <@${studentId}>. Created room <#${channel.id}>.`)
          .setColor(Colors.Green),
      ],
    })
    logger.info(`Tutor ${interaction.user.username} picked student ${studentId} from queue '${queue.name}'. Created room '${channelName}' (${channel.id})`)
  }

  async setWaitingRoom(guildId: string, queueName: string, channelId: string) {
    const result = await db.update(queues)
      .set({ waitingRoomId: channelId })
      .where(and(eq(queues.guildId, guildId), eq(queues.name, queueName)))
      .returning()

    if (result.length === 0) {
      throw new QueueNotFoundError(queueName)
    }
    logger.info(`[Set Waiting Room] Queue "${queueName}" in guild ${guildId} waiting room set to ${channelId}.`)
  }

  async setLogChannel(guildId: string, queueName: string, channelId: string) {
    const result = await db.update(queues)
      .set({ logChannelId: channelId })
      .where(and(eq(queues.guildId, guildId), eq(queues.name, queueName)))
      .returning()

    if (result.length === 0) {
      throw new QueueNotFoundError(queueName)
    }
    logger.info(`[Set Log Channel] Queue "${queueName}" in guild ${guildId} log channel set to ${channelId}.`)
  }

  async createSession(guildId: string, queueName: string, tutorId: string) {
    const queue = await this.getQueueByName(guildId, queueName)
    if (!queue) {
      throw new QueueNotFoundError(queueName)
    }

    // Check if tutor already has an active session in this guild
    const [activeSession] = await db.select()
      .from(sessions)
      .innerJoin(queues, eq(sessions.queueId, queues.id))
      .where(and(
        eq(queues.guildId, guildId),
        eq(sessions.tutorId, tutorId),
        isNull(sessions.endTime),
      ))

    if (activeSession) {
      throw new SessionAlreadyActiveError()
    }

    // Check if user is currently in a queue as a student
    const currentQueue = await this.getQueueByUser(guildId, tutorId)
    if (currentQueue) {
      throw new StudentCannotStartSessionError()
    }

    await db.insert(sessions).values({
      queueId: queue.id,
      tutorId,
    })

    await this.logToChannel(queue, `Tutor <@${tutorId}> started a session.`)
    logger.info(`[Create Session] Tutor ${tutorId} started session on queue "${queueName}" in guild ${guildId}.`)

    // Assign active_session role
    try {
      const activeSessionRoleId = await this.guildManager.getRole(guildId, InternalRole.ActiveSession)
      if (activeSessionRoleId) {
        const guild = await bot.guilds.fetch(guildId)
        const member = await guild.members.fetch(tutorId)
        await member.roles.add(activeSessionRoleId)
      }
    } catch (error) {
      logger.error(`Failed to assign active_session role to tutor ${tutorId}:`, error)
    }
  }

  async endSession(guildId: string, tutorId: string) {
    const activeSession = await this.getActiveSession(guildId, tutorId)
    if (!activeSession) {
      throw new QueueError("You do not have an active session.")
    }

    const { session, queue } = activeSession

    const result = await db.update(sessions)
      .set({ endTime: new Date() })
      .where(eq(sessions.id, session.id))
      .returning()

    if (result.length > 0) {
      await this.logToChannel(queue, `Tutor <@${tutorId}> ended their session.`)
      logger.info(`[End Session] Tutor ${tutorId} ended session in guild ${guildId}.`)

      // Remove active_session role
      try {
        const activeSessionRoleId = await this.guildManager.getRole(guildId, InternalRole.ActiveSession)
        if (activeSessionRoleId) {
          const guild = await bot.guilds.fetch(guildId)
          const member = await guild.members.fetch(tutorId)
          await member.roles.remove(activeSessionRoleId)
        }
      } catch (error) {
        logger.error(`Failed to remove active_session role from tutor ${tutorId}:`, error)
      }
    }
  }

  async resolveQueue(guildId: string, queueName?: string) {
    if (queueName) {
      const queue = await this.getQueueByName(guildId, queueName)
      if (!queue) throw new QueueNotFoundError(queueName)
      return queue
    }

    const allQueues = await this.listQueues(guildId)
    if (allQueues.length === 0) {
      throw new QueueError("No queues found in this server.")
    }
    if (allQueues.length === 1) {
      return allQueues[0]
    }
    throw new QueueError("Multiple queues found. Please specify a queue name.")
  }

  async getQueueByUser(guildId: string, userId: string) {
    const [member] = await db.select({
      queue: queues,
    })
      .from(queueMembers)
      .innerJoin(queues, eq(queueMembers.queueId, queues.id))
      .where(and(
        eq(queues.guildId, guildId),
        eq(queueMembers.userId, userId),
        isNull(queueMembers.leftAt),
      ))

    return member?.queue ?? null
  }

  async getQueueByWaitingRoom(guildId: string, channelId: string) {
    const [queue] = await db.select()
      .from(queues)
      .where(and(eq(queues.guildId, guildId), eq(queues.waitingRoomId, channelId)))
    return queue ?? null
  }

  private async logToChannel(queue: typeof queues.$inferSelect, message: string) {
    if (!queue.logChannelId) return

    try {
      const channel = await bot.channels.fetch(queue.logChannelId)

      if (channel && channel.type === ChannelType.GuildText) {
        // Get stats
        const [memberCount] = await db.select({ count: sql<number>`count(*)` })
          .from(queueMembers)
          .where(and(eq(queueMembers.queueId, queue.id), isNull(queueMembers.leftAt)))

        const [sessionCount] = await db.select({ count: sql<number>`count(*)` })
          .from(sessions)
          .where(and(eq(sessions.queueId, queue.id), isNull(sessions.endTime)))

        const activeSessionRole = await this.guildManager.getRole(queue.guildId, InternalRole.ActiveSession)
        const prefix = activeSessionRole ? `<@&${activeSessionRole}> ` : ""

        const embed = new EmbedBuilder()
          .setTitle(`Queue Update: ${queue.name}`)
          .setDescription(message)
          .addFields(
            { name: "Members in Queue", value: String(memberCount?.count ?? 0), inline: true },
            { name: "Active Sessions", value: String(sessionCount?.count ?? 0), inline: true },
          )
          .setColor(Colors.Blue)
          .setTimestamp()

        await channel.send({ content: prefix || undefined, embeds: [embed] })
      }
    } catch (error) {
      logger.error(`Failed to log to channel ${queue.logChannelId}:`, error)
    }
  }

  async getQueueSummaryEmbed(guildId: string, queueName: string) {
    const queue = await this.getQueueByName(guildId, queueName)
    if (!queue) throw new QueueNotFoundError(queueName)

    const allQueues = await this.listQueues(guildId)
    const queueStats = allQueues.find(q => q.id === queue.id)

    if (!queueStats) throw new QueueError("Queue not found.")

    return new EmbedBuilder()
      .setTitle(`Queue Summary: ${queue.name}`)
      .setDescription(queue.description || "No description.")
      .addFields(
        { name: "Students in Queue", value: String(queueStats.memberCount), inline: true },
        { name: "Active Sessions", value: String(queueStats.sessionCount), inline: true },
        { name: "Locked", value: queue.isLocked ? "Yes" : "No", inline: true },
      )
      .setColor(Colors.Blue)
      .setFooter({ text: `Queue ID: ${queue.id}` })
  }

  async getQueueListEmbed(guildId: string, queueName: string, limit: number = 5) {
    const queue = await this.getQueueByName(guildId, queueName)
    if (!queue) throw new QueueNotFoundError(queueName)

    const members = await this.getQueueMembers(guildId, queueName, limit)

    if (members.length === 0) {
      return new EmbedBuilder()
        .setTitle(`Queue: ${queue.name}`)
        .setDescription("The queue is empty.")
        .setColor(Colors.Blue)
        .setFooter({ text: "Total: 0" })
    }

    return new EmbedBuilder()
      .setTitle(`Queue: ${queue.name}`)
      .setDescription(members.map((m, i) => `${i + 1}. <@${m.userId}>`).join("\n"))
      .setColor(Colors.Blue)
      .setFooter({ text: `Showing top ${members.length} members` })
  }

  async getQueuePosition(queueId: string, userId: string): Promise<number> {
    const members = await db.select()
      .from(queueMembers)
      .where(and(eq(queueMembers.queueId, queueId), isNull(queueMembers.leftAt)))
      .orderBy(queueMembers.joinedAt)

    return members.findIndex(m => m.userId === userId) + 1
  }

  async getQueueById(queueId: string) {
    const [queue] = await db.select()
      .from(queues)
      .where(eq(queues.id, queueId))
    return queue ?? null
  }

  async getQueueMember(queueId: string, userId: string) {
    const [member] = await db.select()
      .from(queueMembers)
      .where(and(eq(queueMembers.queueId, queueId), eq(queueMembers.userId, userId), isNull(queueMembers.leftAt)))
    return member ?? null
  }

  async getAllActiveSessions(guildId: string) {
    const activeSessions = await db.select({
      session: sessions,
      queueName: queues.name,
      studentCount: sql<number>`count(${sessionStudents.id})`,
    })
      .from(sessions)
      .innerJoin(queues, eq(sessions.queueId, queues.id))
      .leftJoin(sessionStudents, eq(sessions.id, sessionStudents.sessionId))
      .where(and(
        eq(queues.guildId, guildId),
        isNull(sessions.endTime),
      ))
      .groupBy(sessions.id, queues.name)

    return activeSessions.map(({ session, queueName, studentCount }) => ({
      ...session,
      queueName,
      studentCount: Number(studentCount),
    }))
  }

  async terminateSessionsByUser(guildId: string, userId: string) {
    // Find active sessions for this user in this guild
    const activeSessions = await db.select({
      session: sessions,
      queue: queues,
    })
      .from(sessions)
      .innerJoin(queues, eq(sessions.queueId, queues.id))
      .where(and(
        eq(queues.guildId, guildId),
        eq(sessions.tutorId, userId),
        isNull(sessions.endTime),
      ))

    if (activeSessions.length === 0) {
      return 0
    }

    // Terminate them
    const sessionIds = activeSessions.map(s => s.session.id)
    await db.update(sessions)
      .set({ endTime: new Date() })
      .where(sql`${sessions.id} IN ${sessionIds}`)

    // Log for each session
    for (const { session, queue } of activeSessions) {
      await this.logToChannel(queue, `Session for <@${session.tutorId}> was forcefully terminated by admin.`)
      logger.info(`[Terminate Session] Session ${session.id} for tutor ${session.tutorId} terminated by admin in guild ${guildId}.`)

      // Remove active_session role
      try {
        const activeSessionRoleId = await this.guildManager.getRole(guildId, InternalRole.ActiveSession)
        if (activeSessionRoleId) {
          const guild = await bot.guilds.fetch(guildId)
          const member = await guild.members.fetch(session.tutorId)
          await member.roles.remove(activeSessionRoleId)
        }
      } catch (error) {
        logger.error(`Failed to remove active_session role from tutor ${session.tutorId}:`, error)
      }
    }

    return activeSessions.length
  }

  async terminateAllSessions(guildId: string) {
    // Find all active sessions in this guild
    const activeSessions = await db.select({
      session: sessions,
      queue: queues,
    })
      .from(sessions)
      .innerJoin(queues, eq(sessions.queueId, queues.id))
      .where(and(
        eq(queues.guildId, guildId),
        isNull(sessions.endTime),
      ))

    if (activeSessions.length === 0) {
      return 0
    }

    // Terminate them
    const sessionIds = activeSessions.map(s => s.session.id)
    await db.update(sessions)
      .set({ endTime: new Date() })
      .where(sql`${sessions.id} IN ${sessionIds}`)

    // Log for each session
    for (const { session, queue } of activeSessions) {
      await this.logToChannel(queue, `Session for <@${session.tutorId}> was forcefully terminated by admin (Terminate All).`)
      logger.info(`[Terminate All Sessions] Session ${session.id} for tutor ${session.tutorId} terminated by admin in guild ${guildId}.`)

      // Remove active_session role
      try {
        const activeSessionRoleId = await this.guildManager.getRole(guildId, InternalRole.ActiveSession)
        if (activeSessionRoleId) {
          const guild = await bot.guilds.fetch(guildId)
          const member = await guild.members.fetch(session.tutorId)
          await member.roles.remove(activeSessionRoleId)
        }
      } catch (error) {
        logger.error(`Failed to remove active_session role from tutor ${session.tutorId}:`, error)
      }
    }

    return activeSessions.length
  }

  async setQueueLockState(guildId: string, queueName: string, isLocked: boolean) {
    const queue = await this.getQueueByName(guildId, queueName)
    if (!queue) {
      throw new QueueNotFoundError(queueName)
    }

    if (queue.isLocked === isLocked) {
      throw new QueueError(`Queue "${queueName}" is already ${isLocked ? "locked" : "unlocked"}.`)
    }

    await db.update(queues)
      .set({ isLocked })
      .where(eq(queues.id, queue.id))

    logger.info(`[Set Lock State] Queue "${queueName}" in guild ${guildId} set to ${isLocked ? "locked" : "unlocked"}.`)
  }
}
