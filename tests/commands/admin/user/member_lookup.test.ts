import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { AdminMemberLookupCommand } from "@commands/admin/user/member_lookup"
import { UserManager } from "@managers/UserManager"
import { CommandInteraction, Guild, GuildMember, User } from "discord.js"
import { mockDeep } from "vitest-mock-extended"
import { UserNotVerifiedError } from "@errors/UserErrors"

describe("AdminMemberLookupCommand", () => {
  let command: AdminMemberLookupCommand
  let mockUserManager: any
  let mockInteraction: any
  let mockGuild: any
  let mockUser: any
  let mockMember: any

  // Mock logger
  vi.mock("@utils/logger", () => ({
    default: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  }))

  beforeEach(() => {
    mockUserManager = mockDeep<UserManager>()
    command = new AdminMemberLookupCommand(mockUserManager)

    mockUser = mockDeep<User>()
    mockUser.id = "user-123"
    mockUser.username = "testuser"
    mockUser.displayAvatarURL = vi.fn().mockReturnValue("https://example.com/avatar.png")

    mockMember = mockDeep<GuildMember>()

    mockGuild = mockDeep<Guild>()
    mockGuild.id = "guild-123"
    mockGuild.members.fetch = vi.fn().mockResolvedValue(mockMember)

    mockInteraction = mockDeep<CommandInteraction>()
    mockInteraction.guild = mockGuild
    mockInteraction.user = { username: "admin" }
    mockInteraction.reply = vi.fn()
  })

  it("should display user information successfully", async () => {
    const userData = {
      discordId: "user-123",
      tuId: "tu123",
      moodleId: "moodle456",
      verifiedAt: new Date("2024-01-01"),
    }
    mockUserManager.getUserData.mockResolvedValue(userData)

    await command.memberLookup(mockUser, mockInteraction)

    expect(mockGuild.members.fetch).toHaveBeenCalledWith("user-123")
    expect(mockUserManager.getUserData).toHaveBeenCalledWith(mockMember)
    expect(mockInteraction.reply).toHaveBeenCalled()

    const call = mockInteraction.reply.mock.calls[0][0]
    expect(call.embeds[0].data.title).toContain("User Information")
    const fields = call.embeds[0].data.fields
    expect(fields.some((f: any) => f.name === "TU ID" && f.value === "tu123")).toBe(true)
    expect(fields.some((f: any) => f.name === "Moodle ID" && f.value === "moodle456")).toBe(true)
  })

  it("should handle user not in guild", async () => {
    mockGuild.members.fetch.mockRejectedValue(new Error("Not found"))

    await command.memberLookup(mockUser, mockInteraction)

    expect(mockUserManager.getUserData).not.toHaveBeenCalled()
    expect(mockInteraction.reply).toHaveBeenCalled()

    const call = mockInteraction.reply.mock.calls[0][0]
    expect(call.embeds[0].data.description).toContain("not a member")
  })

  it("should handle user not verified", async () => {
    mockUserManager.getUserData.mockRejectedValue(new UserNotVerifiedError())

    await command.memberLookup(mockUser, mockInteraction)

    expect(mockInteraction.reply).toHaveBeenCalled()
    const call = mockInteraction.reply.mock.calls[0][0]
    expect(call.embeds[0].data.description).toContain("not verified")
  })

  it("should display 'Not available' for missing data", async () => {
    const userData = {
      discordId: "user-123",
      tuId: null,
      moodleId: null,
      verifiedAt: new Date("2024-01-01"),
    }
    mockUserManager.getUserData.mockResolvedValue(userData)

    await command.memberLookup(mockUser, mockInteraction)

    const call = mockInteraction.reply.mock.calls[0][0]
    const fields = call.embeds[0].data.fields
    expect(fields.some((f: any) => f.name === "TU ID" && f.value === "Not available")).toBe(true)
    expect(fields.some((f: any) => f.name === "Moodle ID" && f.value === "Not available")).toBe(true)
  })

  it("should handle getUserData throwing generic error", async () => {
    mockUserManager.getUserData.mockRejectedValue(new Error("Database connection failed"))

    await command.memberLookup(mockUser, mockInteraction)

    expect(mockInteraction.reply).toHaveBeenCalled()
    const call = mockInteraction.reply.mock.calls[0][0]
    expect(call.embeds[0].data.description).toContain("error occurred")
  })
})
