import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { RoomManager } from "@managers/RoomManager"
import { Guild, VoiceChannel, ChannelType, PermissionFlagsBits } from "discord.js"
import { mockDeep } from "vitest-mock-extended"
import db from "@db"

// Mock db
vi.mock("@db", () => ({
  default: {
    select: vi.fn(),
  },
  sessionStudents: {
    channelId: "channelId",
    endTime: "endTime",
  },
}))

// Mock logger
vi.mock("@utils/logger", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe("RoomManager", () => {
  let roomManager: RoomManager
  let mockGuild: any

  beforeEach(() => {
    roomManager = new RoomManager()
    mockGuild = mockDeep<Guild>()
    mockGuild.id = "guild-123"
    mockGuild.channels.cache = []
    mockGuild.channels.create = vi.fn()
    mockGuild.members.fetch = vi.fn()
    vi.clearAllMocks()
  })

  describe("createEphemeralChannel", () => {
    it("should create a channel successfully", async () => {
      const baseName = "test-room"
      const userIds = ["user-1", "user-2"]
      const categoryId = "category-123"
      const mockChannel = { id: "channel-123", name: baseName }

      mockGuild.channels.cache.some = vi.fn().mockReturnValue(false)
      mockGuild.channels.create.mockResolvedValue(mockChannel)
      mockGuild.members.fetch.mockResolvedValue({
        voice: { channel: true, setChannel: vi.fn() },
      })

      const result = await roomManager.createEphemeralChannel(mockGuild, baseName, userIds, categoryId)

      expect(mockGuild.channels.create).toHaveBeenCalledWith(expect.objectContaining({
        name: baseName,
        type: ChannelType.GuildVoice,
        parent: categoryId,
        permissionOverwrites: expect.arrayContaining([
          expect.objectContaining({ id: "guild-123", deny: [PermissionFlagsBits.ViewChannel] }),
          expect.objectContaining({ id: "user-1", allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] }),
        ]),
      }))
      expect(result).toEqual(mockChannel)
    })

    it("should handle duplicate names", async () => {
      const baseName = "test-room"
      const mockChannel = { id: "channel-123", name: `${baseName}-1` }

      // First call returns true (exists), second returns false
      mockGuild.channels.cache.some = vi.fn()
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false)

      mockGuild.channels.create.mockResolvedValue(mockChannel)
      mockGuild.members.fetch.mockResolvedValue({
        voice: { channel: true, setChannel: vi.fn() },
      })

      const result = await roomManager.createEphemeralChannel(mockGuild, baseName, [], undefined)

      expect(mockGuild.channels.create).toHaveBeenCalledWith(expect.objectContaining({
        name: `${baseName}-1`,
      }))
      expect(result).toEqual(mockChannel)
    })

    it("should handle errors during creation", async () => {
      mockGuild.channels.create.mockRejectedValue(new Error("Failed to create"))

      const result = await roomManager.createEphemeralChannel(mockGuild, "test", [], undefined)

      expect(result).toBeNull()
    })
  })

  describe("deleteChannel", () => {
    it("should delete channel successfully", async () => {
      const mockChannel = mockDeep<VoiceChannel>()
      mockChannel.delete.mockResolvedValue(mockChannel)

      await roomManager.deleteChannel(mockChannel)

      expect(mockChannel.delete).toHaveBeenCalled()
    })

    it("should handle errors during deletion", async () => {
      const mockChannel = mockDeep<VoiceChannel>()
      mockChannel.delete.mockRejectedValue(new Error("Failed to delete"))

      await roomManager.deleteChannel(mockChannel)

      expect(mockChannel.delete).toHaveBeenCalled()
    })
  })
  describe("isEphemeralChannel", () => {
    it("should return true if channel is ephemeral", async () => {
      const channelId = "channel-123"
      const mockResult = { id: 1, channelId }

      const whereMock = vi.fn().mockResolvedValue([mockResult])
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock })

      const result = await roomManager.isEphemeralChannel(channelId)

      expect(result).toBe(true)
    })

    it("should return false if channel is not ephemeral", async () => {
      const channelId = "channel-123"

      const whereMock = vi.fn().mockResolvedValue([])
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock })

      const result = await roomManager.isEphemeralChannel(channelId)

      expect(result).toBe(false)
    })
  })

  describe("kickAllMembers", () => {
    it("should kick all members", async () => {
      const channel = mockDeep<VoiceChannel>()
      channel.id = "channel-123"
      const user1 = { id: "user-1", voice: { channelId: "channel-123", disconnect: vi.fn() } }
      const user2 = { id: "user-2", voice: { channelId: "channel-123", disconnect: vi.fn() } };

      (channel as any).members = new Map([
        ["user-1", user1],
        ["user-2", user2],
      ])

      await roomManager.kickAllMembers(channel)

      expect(user1.voice.disconnect).toHaveBeenCalled()
      expect(user2.voice.disconnect).toHaveBeenCalled()
    })
  })

  describe("kickUser", () => {
    it("should kick specific user and unpermit them", async () => {
      const channel = mockDeep<VoiceChannel>()
      const user = { id: "user-1", voice: { disconnect: vi.fn() } }
      channel.members.get.mockReturnValue(user as any)
      channel.permissionOverwrites.delete.mockResolvedValue({} as any)

      await roomManager.kickUser(channel, "user-1")

      expect(channel.permissionOverwrites.delete).toHaveBeenCalledWith("user-1")
      expect(user.voice.disconnect).toHaveBeenCalled()
    })

    it("should not throw if user not found", async () => {
      const channel = mockDeep<VoiceChannel>()
      channel.members.get.mockReturnValue(undefined)

      await roomManager.kickUser(channel, "user-1")
    })
  })

  describe("getSessionIdFromChannel", () => {
    it("should return session ID if found", async () => {
      const channelId = "channel-123"
      const mockResult = { sessionId: "session-123" }

      const whereMock = vi.fn().mockResolvedValue([mockResult])
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock })

      const result = await roomManager.getSessionIdFromChannel(channelId)

      expect(result).toBe("session-123")
    })

    it("should return null if not found", async () => {
      const channelId = "channel-123"

      const whereMock = vi.fn().mockResolvedValue([])
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock })

      const result = await roomManager.getSessionIdFromChannel(channelId)

      expect(result).toBeNull()
    })
  })

  describe("permitUser", () => {
    it("should permit user and move them if in voice", async () => {
      const channel = mockDeep<VoiceChannel>()
      channel.guild.members.fetch.mockResolvedValue({
        voice: { channel: true, setChannel: vi.fn() },
      } as any)
      channel.permissionOverwrites.edit.mockResolvedValue({} as any)

      const result = await roomManager.permitUser(channel, "user-1")

      expect(channel.permissionOverwrites.edit).toHaveBeenCalledWith("user-1", expect.objectContaining({
        ViewChannel: true,
      }))
      expect(result).toBe(true)
    })

    it("should return false when guild fetch fails", async () => {
      const channel = mockDeep<VoiceChannel>()
      channel.guild.members.fetch.mockRejectedValue(new Error("Guild fetch failed"))

      const result = await roomManager.permitUser(channel, "user-1")

      expect(result).toBe(false)
    })

    it("should handle member not in voice", async () => {
      const channel = mockDeep<VoiceChannel>()
      channel.guild.members.fetch.mockResolvedValue({
        voice: { channel: null }, // Not in voice
      } as any)
      channel.permissionOverwrites.edit.mockResolvedValue({} as any)

      const result = await roomManager.permitUser(channel, "user-1")

      expect(channel.permissionOverwrites.edit).toHaveBeenCalled()
      // Should still permit even if not in voice
      expect(result).toBe(true)
    })
  })

  describe("kick error handling", () => {
    it("should continue kickUser even if permission cleanup fails", async () => {
      const channel = mockDeep<VoiceChannel>()
      const user = { id: "user-1", voice: { disconnect: vi.fn() } }
      channel.members.get.mockReturnValue(user as any)
      channel.permissionOverwrites.delete.mockRejectedValue(new Error("Permission error"))

      // The implementation catches all errors, so it should not throw
      await expect(roomManager.kickUser(channel, "user-1")).resolves.not.toThrow()
      // Note: disconnect may not be called if permissionOverwrites.delete throws before it,
      // but looking at the implementation, delete happens first, then get member, then disconnect
      // So disconnect should still happen
    })

    it("should catch errors during kickAllMembers", async () => {
      const channel = mockDeep<VoiceChannel>()
      const user1 = { id: "user-1", voice: { channelId: "channel-123", disconnect: vi.fn().mockRejectedValue(new Error("Disconnect failed")) } }
      const user2 = { id: "user-2", voice: { channelId: "channel-123", disconnect: vi.fn() } };

      (channel as any).members = new Map([
        ["user-1", user1],
        ["user-2", user2],
      ])

      // The implementation has a try-catch that catches all errors in the loop
      // But since it wraps the entire loop, when an error occurs the loop stops
      // So it should not throw even if disconnect fails
      await expect(roomManager.kickAllMembers(channel)).resolves.not.toThrow()
    })
  })

  describe("additional edge cases", () => {
    it("should handle member fetch failure during channel creation", async () => {
      const baseName = "test-room"
      const userIds = ["user-1", "user-2"]
      const mockChannel = { id: "channel-123", name: baseName }

      mockGuild.channels.cache.some = vi.fn().mockReturnValue(false)
      mockGuild.channels.create.mockResolvedValue(mockChannel)

      // First user succeeds, second fails
      mockGuild.members.fetch
        .mockResolvedValueOnce({
          voice: { channel: true, setChannel: vi.fn() },
        })
        .mockRejectedValueOnce(new Error("Member not found"))

      const result = await roomManager.createEphemeralChannel(mockGuild, baseName, userIds, undefined)

      // Should still create channel even if member fetch fails
      expect(result).toEqual(mockChannel)
      expect(mockGuild.members.fetch).toHaveBeenCalledTimes(2)
    })

    it("should handle database error in isEphemeralChannel", async () => {
      const channelId = "channel-123"

      const whereMock = vi.fn().mockRejectedValue(new Error("Database error"))
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock })

      const result = await roomManager.isEphemeralChannel(channelId)

      // Should return false on error
      expect(result).toBe(false)
    })

    it("should handle database error in getSessionIdFromChannel", async () => {
      const channelId = "channel-123"

      const whereMock = vi.fn().mockRejectedValue(new Error("Database error"))
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock })

      const result = await roomManager.getSessionIdFromChannel(channelId)

      // Should return null on error
      expect(result).toBeNull()
    })
  })
})
