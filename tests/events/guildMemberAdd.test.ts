import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { GuildMemberAddEvent } from "@events/guildMemberAdd"
import { UserManager } from "@managers/UserManager"
import { GuildMember, User, Guild, EmbedBuilder } from "discord.js"
import { mockDeep } from "vitest-mock-extended"

// Mock logger
vi.mock("@utils/logger", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe("GuildMemberAddEvent", () => {
  let event: GuildMemberAddEvent
  let mockUserManager: any
  let mockMember: any
  let mockUser: any
  let mockGuild: any

  beforeEach(() => {
    mockUserManager = mockDeep<UserManager>()
    event = new GuildMemberAddEvent(mockUserManager)

    mockUser = mockDeep<User>()
    mockUser.id = "user-123"
    mockUser.username = "testuser"

    mockGuild = mockDeep<Guild>()
    mockGuild.id = "guild-123"
    mockGuild.name = "Test Guild"
    mockGuild.iconURL = vi.fn().mockReturnValue("https://example.com/icon.png")

    mockMember = mockDeep<GuildMember>()
    mockMember.user = mockUser
    mockMember.guild = mockGuild
    mockMember.send = vi.fn()

    vi.clearAllMocks()
  })

  describe("onMemberJoin", () => {
    it("should send welcome DM to new member", async () => {
      mockUserManager.reapplyRoles.mockRejectedValue(new Error("User not verified"))
      mockMember.send.mockResolvedValue(undefined)

      await event.onMemberJoin([mockMember])

      expect(mockMember.send).toHaveBeenCalledWith({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "Welcome to Test Guild! 🎉",
            }),
          }),
        ]),
      })
    })

    it("should reapply roles for returning verified users", async () => {
      mockUserManager.reapplyRoles.mockResolvedValue(undefined)
      mockMember.send.mockResolvedValue(undefined)

      await event.onMemberJoin([mockMember])

      expect(mockUserManager.reapplyRoles).toHaveBeenCalledWith(mockMember)
    })

    it("should handle failed role reapplication gracefully", async () => {
      mockUserManager.reapplyRoles.mockRejectedValue(new Error("Database error"))
      mockMember.send.mockResolvedValue(undefined)

      await expect(event.onMemberJoin([mockMember])).resolves.toBeUndefined()

      // Should still send welcome message even if role reapplication fails
      expect(mockMember.send).toHaveBeenCalled()
    })

    it("should handle failed DM send gracefully", async () => {
      mockUserManager.reapplyRoles.mockRejectedValue(new Error("User not verified"))
      mockMember.send.mockRejectedValue(new Error("Cannot send messages to this user"))

      await expect(event.onMemberJoin([mockMember])).resolves.toBeUndefined()

      // Should not throw error even if DM fails
      const logger = await import("@utils/logger")
      expect(logger.default.warn).toHaveBeenCalled()
    })

    it("should include verification instructions in welcome embed", async () => {
      mockUserManager.reapplyRoles.mockRejectedValue(new Error("User not verified"))
      mockMember.send.mockResolvedValue(undefined)

      await event.onMemberJoin([mockMember])

      const embedCall = mockMember.send.mock.calls[0][0]
      const embed = embedCall.embeds[0]

      expect(embed.data.description).toContain("verify")
      expect(embed.data.description).toContain("token")
    })

    it("should set guild icon as embed thumbnail", async () => {
      mockUserManager.reapplyRoles.mockRejectedValue(new Error("User not verified"))
      mockMember.send.mockResolvedValue(undefined)

      await event.onMemberJoin([mockMember])

      const embedCall = mockMember.send.mock.calls[0][0]
      const embed = embedCall.embeds[0]

      expect(embed.data.thumbnail?.url).toBe("https://example.com/icon.png")
    })

    it("should successfully reapply roles and send DM", async () => {
      mockUserManager.reapplyRoles.mockResolvedValue(undefined)
      mockMember.send.mockResolvedValue(undefined)

      await event.onMemberJoin([mockMember])

      expect(mockUserManager.reapplyRoles).toHaveBeenCalledWith(mockMember)
      expect(mockMember.send).toHaveBeenCalled()

      const logger = await import("@utils/logger")
      expect(logger.default.info).toHaveBeenCalledWith(
        expect.stringContaining("Sent welcome message to testuser")
      )
    })
  })
})
