import {
  ChannelType,
  Guild,
  VoiceChannel,
  PermissionFlagsBits,
} from "discord.js"
import logger from "@utils/logger"

export class RoomManager {
  async createEphemeralChannel(
    guild: Guild,
    name: string,
    userIds: string[],
    categoryId?: string,
  ): Promise<VoiceChannel | null> {
    try {
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

      return channel
    } catch (error) {
      logger.error("Failed to create ephemeral channel:", error)
      return null
    }
  }

  async deleteChannel(channel: VoiceChannel) {
    try {
      await channel.delete()
    } catch (error) {
      logger.error(`Failed to delete channel ${channel.id}:`, error)
    }
  }
}
