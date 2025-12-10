import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { AdminSearchCommand, IdType } from "@commands/admin/user/search"
import { UserManager } from "@managers/UserManager"
import { CommandInteraction, Guild, Client, User } from "discord.js"
import { mockDeep } from "vitest-mock-extended"
import { UserNotVerifiedError } from "@errors/UserErrors"

// Mock logger
vi.mock("@utils/logger", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe("AdminSearchCommand", () => {
  let command: AdminSearchCommand
  let mockUserManager: any
  let mockInteraction: any
  let mockGuild: any
  let mockClient: any
  let mockUser: any

  beforeEach(() => {
    mockUserManager = mockDeep<UserManager>()
    command = new AdminSearchCommand(mockUserManager)

    mockUser = mockDeep<User>()
    mockUser.username = "testuser"
    mockUser.displayAvatarURL = vi.fn().mockReturnValue("https://example.com/avatar.png")

    mockClient = mockDeep<Client>()
    mockClient.users.fetch = vi.fn().mockResolvedValue(mockUser)

    mockGuild = mockDeep<Guild>()
    mockGuild.id = "guild-123"

    mockInteraction = mockDeep<CommandInteraction>()
    mockInteraction.guild = mockGuild
    mockInteraction.client = mockClient
    mockInteraction.user = { username: "admin" }
    mockInteraction.reply = vi.fn()
  })

  it("should search by Discord ID successfully", async () => {
    const userData = {
      discordId: "user-123",
      guildId: "guild-123",
      tuId: "tu123",
      moodleId: "moodle456",
      verifiedAt: new Date("2024-01-01"),
    }
    mockUserManager.searchUser.mockResolvedValue(userData)

    await command.search(IdType.Discord, "user-123", mockInteraction)

    expect(mockUserManager.searchUser).toHaveBeenCalledWith("guild-123", "discord", "user-123")
    expect(mockInteraction.reply).toHaveBeenCalled()

    const call = mockInteraction.reply.mock.calls[0][0]
    expect(call.embeds[0].data.title).toContain("Search Results")
    const fields = call.embeds[0].data.fields
    expect(fields.some((f: any) => f.name === "Discord ID" && f.value === "user-123")).toBe(true)
    expect(fields.some((f: any) => f.name === "TU ID" && f.value === "tu123")).toBe(true)
    expect(fields.some((f: any) => f.name === "Moodle ID" && f.value === "moodle456")).toBe(true)
  })

  it("should search by TU ID successfully", async () => {
    const userData = {
      discordId: "user-123",
      guildId: "guild-123",
      tuId: "tu123",
      moodleId: "moodle456",
      verifiedAt: new Date("2024-01-01"),
    }
    mockUserManager.searchUser.mockResolvedValue(userData)

    await command.search(IdType.TU, "tu123", mockInteraction)

    expect(mockUserManager.searchUser).toHaveBeenCalledWith("guild-123", "tu", "tu123")
    expect(mockInteraction.reply).toHaveBeenCalled()
  })

  it("should search by Moodle ID successfully", async () => {
    const userData = {
      discordId: "user-123",
      guildId: "guild-123",
      tuId: "tu123",
      moodleId: "moodle456",
      verifiedAt: new Date("2024-01-01"),
    }
    mockUserManager.searchUser.mockResolvedValue(userData)

    await command.search(IdType.Moodle, "moodle456", mockInteraction)

    expect(mockUserManager.searchUser).toHaveBeenCalledWith("guild-123", "moodle", "moodle456")
    expect(mockInteraction.reply).toHaveBeenCalled()
  })

  it("should handle user not found", async () => {
    mockUserManager.searchUser.mockRejectedValue(new UserNotVerifiedError())

    await command.search(IdType.Discord, "user-123", mockInteraction)

    expect(mockInteraction.reply).toHaveBeenCalled()
    const call = mockInteraction.reply.mock.calls[0][0]
    expect(call.embeds[0].data.description).toContain("No user found")
  })

  it("should handle command used outside of guild", async () => {
    mockInteraction.guild = null

    await command.search(IdType.Discord, "user-123", mockInteraction)

    expect(mockUserManager.searchUser).not.toHaveBeenCalled()
    expect(mockInteraction.reply).toHaveBeenCalled()
    const call = mockInteraction.reply.mock.calls[0][0]
    expect(call.embeds[0].data.description).toContain("only be used in a server")
  })

  it("should handle failed Discord user fetch", async () => {
    const userData = {
      discordId: "user-123",
      guildId: "guild-123",
      tuId: "tu123",
      moodleId: "moodle456",
      verifiedAt: new Date("2024-01-01"),
    }
    mockUserManager.searchUser.mockResolvedValue(userData)
    mockClient.users.fetch.mockRejectedValue(new Error("User not found"))

    await command.search(IdType.Discord, "user-123", mockInteraction)

    expect(mockInteraction.reply).toHaveBeenCalled()
    const call = mockInteraction.reply.mock.calls[0][0]
    const fields = call.embeds[0].data.fields
    expect(fields.some((f: any) => f.name === "Discord User" && f.value === "Unknown")).toBe(true)
  })

  it("should display 'Not available' for missing data", async () => {
    const userData = {
      discordId: "user-123",
      guildId: "guild-123",
      tuId: null,
      moodleId: null,
      verifiedAt: new Date("2024-01-01"),
    }
    mockUserManager.searchUser.mockResolvedValue(userData)

    await command.search(IdType.Discord, "user-123", mockInteraction)

    const call = mockInteraction.reply.mock.calls[0][0]
    const fields = call.embeds[0].data.fields
    expect(fields.some((f: any) => f.name === "TU ID" && f.value === "Not available")).toBe(true)
    expect(fields.some((f: any) => f.name === "Moodle ID" && f.value === "Not available")).toBe(true)
  })

  it("should handle searchUser throwing unexpected error", async () => {
    mockUserManager.searchUser.mockRejectedValue(new Error("Database connection failed"))

    await command.search(IdType.Discord, "user-123", mockInteraction)

    expect(mockInteraction.reply).toHaveBeenCalled()
    const call = mockInteraction.reply.mock.calls[0][0]
    expect(call.embeds[0].data.description).toContain("error occurred")
  })

  it("should handle empty identifier validation", async () => {
    await command.search(IdType.Discord, "", mockInteraction)

    expect(mockUserManager.searchUser).toHaveBeenCalledWith("guild-123", "discord", "")
  })

  it("should handle invalid identifier format", async () => {
    mockUserManager.searchUser.mockRejectedValue(new Error("Invalid identifier format"))

    await command.search(IdType.TU, "invalid-tu-id", mockInteraction)

    expect(mockInteraction.reply).toHaveBeenCalled()
    const call = mockInteraction.reply.mock.calls[0][0]
    expect(call.embeds[0].data.description).toContain("error occurred")
  })
})
