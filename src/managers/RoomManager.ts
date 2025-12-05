import {
  ChannelType,
  Guild,
  VoiceChannel,
  PermissionFlagsBits,
} from "discord.js"
import logger from "@utils/logger"
import { injectable } from "tsyringe"
import db from "@db"
import { sessionStudents } from "@db/schema"
import { eq, and, isNull } from "drizzle-orm"

@injectable()
export class RoomManager {
  async createEphemeralChannel(
    guild: Guild,
    baseName: string,
    userIds: string[],
    categoryId?: string,
  ): Promise<VoiceChannel | null> {
    try {
      let name = baseName
      let counter = 1

      // Ensure unique name
      while (guild.channels.cache.some(c => c.name === name)) {
        name = `${baseName}-${counter}`
        counter++
      }

      const channel = await guild.channels.create({
        name,
        type: ChannelType.GuildVoice,
        parent: categoryId,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          ...userIds.map(userId => ({
            id: userId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
          })),
        ],
      })

      // Move users to the new channel
      for (const userId of userIds) {
        try {
          const member = await guild.members.fetch(userId)
          if (member.voice.channel) {
            await member.voice.setChannel(channel)
          }
        } catch (error) {
          logger.error(`Failed to move user ${userId} to ephemeral channel:`, error)
        }
      }

      logger.info(`[Create Room] Created ephemeral channel "${name}" (${channel.id}) in guild ${guild.id} for users: ${userIds.join(", ")}`)
      return channel
    } catch (error) {
      logger.error("Failed to create ephemeral channel:", error)
      return null
    }
  }

  async deleteChannel(channel: VoiceChannel) {
    try {
      await channel.delete()
      logger.info(`[Delete Room] Deleted channel "${channel.name}" (${channel.id})`)
    } catch (error: any) {
      if (error.code === 10003) {
        logger.warn(`[Delete Room] Channel "${channel.name}" (${channel.id}) was already deleted.`)
      } else {
        logger.error(`Failed to delete channel ${channel.id}:`, error)
      }
    }
  }
  async isEphemeralChannel(channelId: string): Promise<boolean> {
    try {
      const [result] = await db.select()
        .from(sessionStudents)
        .where(
          and(
            eq(sessionStudents.channelId, channelId),
            isNull(sessionStudents.endTime)
          )
        )
      return !!result
    } catch (error) {
      logger.error("Failed to check if channel is ephemeral:", error)
      return false
    }
  }

  async kickAllMembers(channel: VoiceChannel) {
    try {
      for (const [_, member] of channel.members) {
        if (member.voice.channelId === channel.id) {
          await member.voice.disconnect()
        }
      }
      logger.info(`[RoomManager] Kicked all members from channel "${channel.name}" (${channel.id})`)
    } catch (error) {
      logger.error(`Failed to kick all members from channel ${channel.id}:`, error)
    }
  }

  async kickUser(channel: VoiceChannel, userId: string) {
    try {
      // Remove permissions (Unpermit)
      await channel.permissionOverwrites.delete(userId)
      logger.info(`[RoomManager] Removed permissions for user ${userId} in channel "${channel.name}" (${channel.id})`)

      const member = channel.members.get(userId)
      if (member) {
        await member.voice.disconnect()
        logger.info(`[RoomManager] Kicked user ${userId} from channel "${channel.name}" (${channel.id})`)
      }
    } catch (error) {
      logger.error(`Failed to kick/unpermit user ${userId} from channel ${channel.id}:`, error)
    }
  }

  async getSessionIdFromChannel(channelId: string): Promise<string | null> {
    try {
      const [result] = await db.select({ sessionId: sessionStudents.sessionId })
        .from(sessionStudents)
        .where(
          and(
            eq(sessionStudents.channelId, channelId),
            isNull(sessionStudents.endTime)
          )
        )
      return result?.sessionId ?? null
    } catch (error) {
      logger.error("Failed to get session ID from channel:", error)
      return null
    }
  }

  async permitUser(channel: VoiceChannel, userId: string): Promise<boolean> {
    try {
      // Update permissions
      await channel.permissionOverwrites.edit(userId, {
        ViewChannel: true,
        Connect: true,
        Speak: true,
      })

      // Try to move user if they are in a voice channel in the same guild
      const member = await channel.guild.members.fetch(userId)
      if (member.voice.channel) {
        await member.voice.setChannel(channel)
      }

      logger.info(`[RoomManager] Permitted user ${userId} to join channel "${channel.name}" (${channel.id})`)
      return true
    } catch (error) {
      logger.error(`Failed to permit user ${userId} to channel ${channel.id}:`, error)
      return false
    }
  }
}
