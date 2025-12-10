import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { VerifyCommand } from "@commands/verify"
import { UserManager } from "@managers/UserManager"
import { CommandInteraction, Guild, GuildMember } from "discord.js"
import { mockDeep } from "vitest-mock-extended"
import {
  InvalidTokenError,
  TokenAlreadyUsedError,
  WrongServerError,
} from "@errors/UserErrors"

// Mock logger
vi.mock("@utils/logger", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe("VerifyCommand", () => {
  let command: VerifyCommand
  let mockUserManager: any
  let mockInteraction: any
  let mockGuild: any
  let mockMember: any

  beforeEach(() => {
    mockUserManager = mockDeep<UserManager>()
    command = new VerifyCommand(mockUserManager)

    mockGuild = mockDeep<Guild>()
    mockGuild.id = "guild-123"
    mockGuild.members.fetch = vi.fn()

    mockMember = mockDeep<GuildMember>()

    mockInteraction = mockDeep<CommandInteraction>()
    mockInteraction.guild = mockGuild
    mockInteraction.member = mockMember
    mockInteraction.user = { id: "user-123", username: "testuser" }
    mockInteraction.reply = vi.fn()
    mockGuild.members.fetch.mockResolvedValue(mockMember)
  })

  it("should verify user successfully", async () => {
    mockUserManager.verifyUser.mockResolvedValue(["Verified", "Student"])

    await command.verify("test_token", mockInteraction)

    expect(mockUserManager.verifyUser).toHaveBeenCalledWith(mockMember, "test_token")
    expect(mockInteraction.reply).toHaveBeenCalled()

    const call = mockInteraction.reply.mock.calls[0][0]
    expect(call.embeds[0].data.title).toContain("✅")
    expect(call.embeds[0].data.description).toContain("Verified")
    expect(call.embeds[0].data.description).toContain("Student")
  })

  it("should handle invalid token error", async () => {
    mockUserManager.verifyUser.mockRejectedValue(new InvalidTokenError())

    await command.verify("invalid_token", mockInteraction)

    expect(mockInteraction.reply).toHaveBeenCalled()
    const call = mockInteraction.reply.mock.calls[0][0]
    expect(call.embeds[0].data.description).toContain("Invalid token")
  })

  it("should handle token already used error", async () => {
    mockUserManager.verifyUser.mockRejectedValue(new TokenAlreadyUsedError())

    await command.verify("used_token", mockInteraction)

    expect(mockInteraction.reply).toHaveBeenCalled()
    const call = mockInteraction.reply.mock.calls[0][0]
    expect(call.embeds[0].data.description).toContain("already been used")
  })

  it("should handle wrong server error", async () => {
    mockUserManager.verifyUser.mockRejectedValue(new WrongServerError("different-guild"))

    await command.verify("wrong_server_token", mockInteraction)

    expect(mockInteraction.reply).toHaveBeenCalled()
    const call = mockInteraction.reply.mock.calls[0][0]
    expect(call.embeds[0].data.description).toContain("different server")
  })

  it("should handle command used outside of guild", async () => {
    mockInteraction.guild = null
    mockInteraction.member = null

    await command.verify("test_token", mockInteraction)

    expect(mockUserManager.verifyUser).not.toHaveBeenCalled()
    expect(mockInteraction.reply).toHaveBeenCalled()
    const call = mockInteraction.reply.mock.calls[0][0]
    expect(call.embeds[0].data.description).toContain("only be used in a server")
  })

  it("should handle unknown errors", async () => {
    mockUserManager.verifyUser.mockRejectedValue(new Error("Unknown error"))

    await command.verify("test_token", mockInteraction)

    expect(mockInteraction.reply).toHaveBeenCalled()
    const call = mockInteraction.reply.mock.calls[0][0]
    expect(call.embeds[0].data.description).toContain("unknown error")
  })

  it("should allow duplicate verification", async () => {
    // User verifying again should succeed and update their roles
    mockUserManager.verifyUser.mockResolvedValue(["Verified", "Tutor"])

    await command.verify("test_token", mockInteraction)

    expect(mockUserManager.verifyUser).toHaveBeenCalledWith(mockMember, "test_token")
    expect(mockInteraction.reply).toHaveBeenCalled()

    const call = mockInteraction.reply.mock.calls[0][0]
    expect(call.embeds[0].data.title).toContain("✅")
    expect(call.embeds[0].data.description).toContain("Verified")
    expect(call.embeds[0].data.description).toContain("Tutor")
  })
})
