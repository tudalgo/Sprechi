import db, { InternalRole } from "@db"
import { queues, queueMembers, sessions, sessionStudents, queueSchedules } from "@db/schema"
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
  InvalidQueueScheduleDayError,
  InvalidTimeFormatError,
  InvalidTimeRangeError,
} from "../errors/QueueErrors"
import { bot } from "../bot"
import { EmbedBuilder, Colors, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, CommandInteraction } from "discord.js"
import { RoomManager } from "./RoomManager"
import { GuildManager } from "./GuildManager"
import { inject } from "tsyringe"
import { managers } from "@config/messages"

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

        const username = await this.getUsernameById(userId)
        await this.logToChannel(queue, managers.queue.logs.userRejoined(username, userId))
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

    const username = await this.getUsernameById(userId)
    await this.logToChannel(queue, managers.queue.logs.userJoined(username, userId))
    await this.sendJoinDm(queue, userId)
    logger.info(`[Join Queue] User ${userId} joined queue "${queue.name}" (${queue.id}) in guild ${guildId}.`)
  }

  private async sendJoinDm(queue: typeof queues.$inferSelect, userId: string) {
    try {
      const user = await bot.users.fetch(userId)
      const position = await this.getQueuePosition(queue.id, userId)

      const member = await this.getQueueMember(queue.id, userId)

      const embed = new EmbedBuilder()
        .setTitle(managers.queue.dms.joinedQueue.title(queue.name))
        .setDescription(managers.queue.dms.joinedQueue.description(queue.name, position, Math.floor(member.joinedAt.getTime() / 1000)))
        .setColor(Colors.Green)
        .setTimestamp()

      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`queue_refresh_${queue.id}`)
            .setLabel(managers.queue.dms.joinedQueue.buttons.refreshStatus)
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`queue_leave_${queue.id}`)
            .setLabel(managers.queue.dms.joinedQueue.buttons.leaveQueue)
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

    const username = await this.getUsernameById(userId)
    await this.logToChannel(queue, managers.queue.logs.userLeftGracePeriod(username, userId))
    logger.info(`[Leave Queue] User ${userId} left queue "${queue.name}" (${queue.id}) in guild ${guildId}`)

    // Remove from waiting room voice channel
    if (queue.waitingRoomId) {
      try {
        const guild = await bot.guilds.fetch(guildId)
        const member = await guild.members.fetch(userId)
        if (member.voice.channelId === queue.waitingRoomId) {
          await member.voice.disconnect(managers.queue.disconnectReason)
        }
      } catch (error) {
        logger.error(`Failed to disconnect user ${userId} from waiting room:`, error)
      }
    }

    // DM User with Rejoin button
    try {
      const user = await bot.users.fetch(userId)
      const embed = new EmbedBuilder()
        .setTitle(managers.queue.dms.leftQueue.title)
        .setDescription(managers.queue.dms.leftQueue.description(queue.name))
        .setColor(Colors.Yellow)
        .setTimestamp()

      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`queue_rejoin_${queue.id}`)
            .setLabel(managers.queue.dms.leftQueue.button)
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

            const username = await this.getUsernameById(userId)
            await this.logToChannel(queue, managers.queue.logs.userLeft(username, userId))
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

    const studentUsername = await this.getUsernameById(userId)
    const tutorUsername = await this.getUsernameById(tutorId)
    await this.logToChannel(queue, managers.queue.logs.userPicked(studentUsername, userId, tutorUsername, tutorId))
    logger.info(`[Pick Student] Tutor ${tutorId} picked student ${userId} from queue "${queue.name}" (${queue.id}). Session: ${sessionId}`)

    // DM Student
    try {
      const user = await bot.users.fetch(userId)
      await user.send({
        embeds: [
          new EmbedBuilder()
            .setTitle(managers.queue.dms.picked.title)
            .setDescription(managers.queue.dms.picked.description(tutorId, channelId))
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
    const channelName = `${interaction.user.displayName}-${queue.name}`
    const channel = await roomManager.createEphemeralChannel(
      interaction.guild!,
      channelName,
      [tutorId, studentId],
      categoryId,
    )

    if (!channel) {
      throw new QueueError(managers.queue.errors.roomCreationFailed)
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
          .setTitle(managers.queue.studentPicked.title)
          .setDescription(managers.queue.studentPicked.description(studentId, channel.id))
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

  async setPrivateLogChannel(guildId: string, queueName: string, channelId: string) {
    const result = await db.update(queues)
      .set({ privateLogChannelId: channelId })
      .where(and(eq(queues.guildId, guildId), eq(queues.name, queueName)))
      .returning()

    if (result.length === 0) {
      throw new QueueNotFoundError(queueName)
    }
    logger.info(`[Set Private Log Channel] Queue "${queueName}" in guild ${guildId} private log channel set to ${channelId}.`)
  }

  async setPublicLogChannel(guildId: string, queueName: string, channelId: string) {
    const result = await db.update(queues)
      .set({ publicLogChannelId: channelId })
      .where(and(eq(queues.guildId, guildId), eq(queues.name, queueName)))
      .returning()

    if (result.length === 0) {
      throw new QueueNotFoundError(queueName)
    }
    logger.info(`[Set Public Log Channel] Queue "${queueName}" in guild ${guildId} public log channel set to ${channelId}.`)
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

    const tutorUsername = await this.getUsernameById(tutorId)
    await this.logToChannel(queue, managers.queue.logs.tutorStarted(tutorUsername, tutorId))
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
      const tutorUsername = await this.getUsernameById(tutorId)
      await this.logToChannel(queue, managers.queue.logs.tutorEnded(tutorUsername, tutorId))
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
      throw new QueueError(managers.queue.errors.noQueues)
    }
    if (allQueues.length === 1) {
      return allQueues[0]
    }
    throw new QueueError(managers.queue.errors.multipleQueues)
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
    if (!queue.privateLogChannelId) return

    try {
      const channel = await bot.channels.fetch(queue.privateLogChannelId)

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
          .setTitle(managers.queue.embeds.queueLog.title(queue.name))
          .setDescription(message)
          .addFields(
            { name: managers.queue.embeds.queueLog.fields.membersInQueue, value: String(memberCount?.count ?? 0), inline: true },
            { name: managers.queue.embeds.queueLog.fields.activeSessions, value: String(sessionCount?.count ?? 0), inline: true },
          )
          .setColor(Colors.Blue)
          .setTimestamp()

        await channel.send({ content: prefix || undefined, embeds: [embed] })
      }
    } catch (error) {
      logger.error(`Failed to log to channel ${queue.privateLogChannelId}:`, error)
    }
  }

  /**
   * Fetch username from Discord API, with fallback to userId if fetch fails
   */
  private async getUsernameById(userId: string): Promise<string> {
    try {
      const user = await bot.users.fetch(userId)
      return user.username
    } catch (error) {
      logger.warn(`Failed to fetch username for user ${userId}:`, error)
      return userId // Fallback to user ID if fetch fails
    }
  }

  private async logToPublicChannel(queue: typeof queues.$inferSelect, message: string, color: number = Colors.Blue) {
    if (!queue.publicLogChannelId) return

    try {
      const channel = await bot.channels.fetch(queue.publicLogChannelId)
      if (channel && channel.type === ChannelType.GuildText) {
        const embed = new EmbedBuilder()
          .setTitle(managers.queue.embeds.publicLog.title(queue.name))
          .setDescription(message)
          .setColor(color)
          .setTimestamp()

        await channel.send({ embeds: [embed] })
      }
    } catch (error) {
      logger.error(`Failed to log to public channel ${queue.publicLogChannelId}:`, error)
    }
  }

  async getQueueSummaryEmbed(guildId: string, queueName: string) {
    const queue = await this.getQueueByName(guildId, queueName)
    if (!queue) throw new QueueNotFoundError(queueName)

    const allQueues = await this.listQueues(guildId)
    const queueStats = allQueues.find(q => q.id === queue.id)

    if (!queueStats) throw new QueueError("Queue not found.")

    return new EmbedBuilder()
      .setTitle(managers.queue.embeds.queueSummary.title(queue.name))
      .setDescription(queue.description || managers.queue.embeds.queueSummary.descriptionFallback)
      .addFields(
        { name: managers.queue.embeds.queueSummary.fields.studentsInQueue, value: String(queueStats.memberCount), inline: true },
        { name: managers.queue.embeds.queueSummary.fields.activeSessions, value: String(queueStats.sessionCount), inline: true },
        { name: managers.queue.embeds.queueSummary.fields.locked, value: queue.isLocked ? "Yes" : "No", inline: true },
      )
      .setColor(Colors.Blue)
      .setFooter({ text: managers.queue.embeds.queueSummary.footer(queue.id) })
  }

  async getQueueListEmbed(guildId: string, queueName: string, limit: number = 5) {
    const queue = await this.getQueueByName(guildId, queueName)
    if (!queue) throw new QueueNotFoundError(queueName)

    const members = await this.getQueueMembers(guildId, queueName, limit)

    if (members.length === 0) {
      return new EmbedBuilder()
        .setTitle(managers.queue.embeds.queueList.title(queue.name))
        .setDescription(managers.queue.embeds.queueList.emptyDescription)
        .setColor(Colors.Blue)
        .setFooter({ text: managers.queue.embeds.queueList.emptyFooter })
    }

    return new EmbedBuilder()
      .setTitle(managers.queue.embeds.queueList.title(queue.name))
      .setDescription(members.map((m, i) => `${i + 1}. <@${m.userId}>`).join("\n"))
      .setColor(Colors.Blue)
      .setFooter({ text: managers.queue.embeds.queueList.footer(members.length) })
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
      const tutorUsername = await this.getUsernameById(session.tutorId)
      await this.logToChannel(queue, managers.queue.logs.sessionTerminatedAdmin(tutorUsername, session.tutorId))
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
      const tutorUsername = await this.getUsernameById(session.tutorId)
      await this.logToChannel(queue, managers.queue.logs.sessionTerminatedAll(tutorUsername, session.tutorId))
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
      throw new QueueError(managers.queue.errors.alreadyLocked(queueName, isLocked))
    }

    await db.update(queues)
      .set({ isLocked })
      .where(eq(queues.id, queue.id))

    const lockStateStr = isLocked ? "locked" : "unlocked"
    logger.info(`[Set Lock State] Queue "${queueName}" in guild ${guildId} set to ${lockStateStr}.`)

    // Update waiting room permissions if waiting room exists
    if (queue.waitingRoomId) {
      try {
        const verifiedRoleId = await this.guildManager.getRole(guildId, InternalRole.Verified)
        if (verifiedRoleId) {
          const guild = await bot.guilds.fetch(guildId)
          const waitingRoomChannel = await guild.channels.fetch(queue.waitingRoomId)

          if (waitingRoomChannel && waitingRoomChannel.isVoiceBased()) {
            if (isLocked) {
              // Deny Connect permission for verified role when locking
              await waitingRoomChannel.permissionOverwrites.edit(verifiedRoleId, {
                Connect: false,
              })
              logger.info(`[Set Lock State] Denied Connect permission for verified role in waiting room ${queue.waitingRoomId}`)
            } else {
              // Remove permission override when unlocking to restore default permissions
              await waitingRoomChannel.permissionOverwrites.edit(verifiedRoleId, {
                Connect: true,
              })
              logger.info(`[Set Lock State] Removed permission override for verified role in waiting room ${queue.waitingRoomId}`)
            }
          }
        }
      } catch (error) {
        logger.error(`Failed to update waiting room permissions for queue "${queueName}":`, error)
      }
    }

    // Log to public log channel with appropriate color (Red for locked, Green for unlocked)
    await this.logToPublicChannel(
      queue,
      managers.queue.logs.queueLockStatePublic(queueName, lockStateStr),
      isLocked ? Colors.Red : Colors.Green,
    )
    await this.logToChannel(
      queue,
      managers.queue.logs.queueLockStatePrivate(queueName, lockStateStr),
    )
  }

  /**
   * Parse day of week string to number (0-6)
   */
  parseDayOfWeek(dayInput: string): number {
    const days: Record<string, number> = {
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
    }
    const day = days[dayInput.toLowerCase()]
    if (day === undefined) {
      throw new InvalidQueueScheduleDayError(dayInput)
    }
    return day
  }

  /**
   * Validate time format (HH:mm)
   */
  validateTimeFormat(time: string): void {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    if (!timeRegex.test(time)) {
      throw new InvalidTimeFormatError()
    }
  }

  /**
   * Validate time range (start < end)
   */
  validateTimeRange(start: string, end: string): void {
    const [startH, startM] = start.split(":").map(Number)
    const [endH, endM] = end.split(":").map(Number)
    const startTotal = startH * 60 + startM
    const endTotal = endH * 60 + endM

    if (startTotal >= endTotal) {
      throw new InvalidTimeRangeError()
    }
  }

  async addSchedule(guildId: string, queueName: string, day: number, start: string, end: string) {
    const queue = await this.getQueueByName(guildId, queueName)
    if (!queue) throw new QueueNotFoundError(queueName)

    // Validation: Start time must be before end time
    const [startH, startM] = start.split(":").map(Number)
    const [endH, endM] = end.split(":").map(Number)
    const startTotal = startH * 60 + startM
    const endTotal = endH * 60 + endM

    if (startTotal >= endTotal) {
      throw new InvalidTimeRangeError()
    }

    await db.insert(queueSchedules)
      .values({
        queueId: queue.id,
        dayOfWeek: day,
        startTime: start,
        endTime: end,
      })
      .onConflictDoUpdate({
        target: [queueSchedules.queueId, queueSchedules.dayOfWeek],
        set: { startTime: start, endTime: end, updatedAt: new Date() },
      })

    logger.info(`[Add Schedule] Added schedule for queue "${queueName}" on day ${day} (${start}-${end}) in guild ${guildId}.`)
  }

  async removeSchedule(guildId: string, queueName: string, day: number) {
    const queue = await this.getQueueByName(guildId, queueName)
    if (!queue) throw new QueueNotFoundError(queueName)

    await db.delete(queueSchedules)
      .where(and(eq(queueSchedules.queueId, queue.id), eq(queueSchedules.dayOfWeek, day)))

    logger.info(`[Remove Schedule] Removed schedule for queue "${queueName}" on day ${day} in guild ${guildId}.`)
  }

  async getSchedules(guildId: string, queueName: string) {
    const queue = await this.getQueueByName(guildId, queueName)
    if (!queue) throw new QueueNotFoundError(queueName)

    return db.select()
      .from(queueSchedules)
      .where(eq(queueSchedules.queueId, queue.id))
      .orderBy(queueSchedules.dayOfWeek)
  }

  async setScheduleShift(guildId: string, queueName: string, minutes: number) {
    const queue = await this.getQueueByName(guildId, queueName)
    if (!queue) throw new QueueNotFoundError(queueName)

    await db.update(queues)
      .set({ scheduleShiftMinutes: minutes })
      .where(eq(queues.id, queue.id))

    logger.info(`[Set Schedule Shift] Set shift to ${minutes}m for queue "${queueName}" in guild ${guildId}.`)
  }

  async setScheduleEnabled(guildId: string, queueName: string, enabled: boolean) {
    const queue = await this.getQueueByName(guildId, queueName)
    if (!queue) throw new QueueNotFoundError(queueName)

    await db.update(queues)
      .set({ scheduleEnabled: enabled })
      .where(eq(queues.id, queue.id))

    logger.info(`[Set Schedule Enabled] Set schedule enabled to ${enabled} for queue "${queueName}" in guild ${guildId}.`)
  }

  async checkSchedules() {
    try {
      const scheduledQueues = await db.select()
        .from(queues)
        .where(eq(queues.scheduleEnabled, true))

      const now = new Date()
      // getDay: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      const currentDay = now.getDay()
      const currentMinutes = now.getHours() * 60 + now.getMinutes()

      for (const queue of scheduledQueues) {
        try {
          const [schedule] = await db.select()
            .from(queueSchedules)
            .where(and(eq(queueSchedules.queueId, queue.id), eq(queueSchedules.dayOfWeek, currentDay)))

          if (!schedule) {
            // No schedule for today -> Close it if it's open
            if (!queue.isLocked) {
              await this.setQueueLockState(queue.guildId, queue.name, true)
            }
            continue
          }

          const [startH, startM] = schedule.startTime.split(":").map(Number)
          const [endH, endM] = schedule.endTime.split(":").map(Number)

          const shift = queue.scheduleShiftMinutes
          const startTotal = (startH * 60 + startM) - shift
          const endTotal = (endH * 60 + endM) - shift

          const isOpenTime = currentMinutes >= startTotal && currentMinutes < endTotal

          if (isOpenTime && queue.isLocked) {
            await this.setQueueLockState(queue.guildId, queue.name, false)
          } else if (!isOpenTime && !queue.isLocked) {
            await this.setQueueLockState(queue.guildId, queue.name, true)
          }
        } catch (err: unknown) {
          // Ignore "already locked/unlocked" errors if they happen despite our check
          // But actually QueueError is thrown.
          if (err instanceof QueueError && err.message.includes("is already")) {
            continue
          }
          logger.error(`Error checking schedule for queue ${queue.id}:`, err)
        }
      }
    } catch (error) {
      logger.error("Error in checkSchedules:", error)
    }
  }
}
