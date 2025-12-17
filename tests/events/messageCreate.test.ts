import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { MessageCreateEvent } from "@events/messageCreate"
import { UserManager } from "@managers/UserManager"
import { Message, Guild, GuildMember, User, ChannelType } from "discord.js"
import { mockDeep } from "vitest-mock-extended"
import {
  TokenAlreadyUsedError,
  UserNotInGuildError,
} from "@errors/UserErrors"
import { decryptTokenString } from "@utils/token"
import { bot } from "@/bot"

// Mock logger
vi.mock("@utils/logger", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock token utils
vi.mock("@utils/token", () => ({
  decryptTokenString: vi.fn(),
}))

// Mock bot
vi.mock("@/bot", () => ({
  bot: {
    guilds: {
      fetch: vi.fn(),
    },
  },
}))

describe("MessageCreateEvent", () => {
  let messageCreateEvent: MessageCreateEvent
  let mockUserManager: any
  let mockMessage: any
  let mockGuild: any
  let mockMember: any
  let mockUser: any

  beforeEach(() => {
    mockUserManager = mockDeep<UserManager>()
    messageCreateEvent = new MessageCreateEvent(mockUserManager)

    mockUser = mockDeep<User>()
    mockUser.id = "user-123"
    mockUser.username = "testuser"
    mockUser.bot = false

    mockMember = mockDeep<GuildMember>()
    mockMember.user = mockUser

    mockGuild = mockDeep<Guild>()
    mockGuild.id = "guild-123"
    mockGuild.name = "Test Guild"
    mockGuild.members.fetch = vi.fn()

    mockMessage = mockDeep<Message>()
    mockMessage.author = mockUser
    mockMessage.channel.type = ChannelType.DM
    mockMessage.content = "test_token"
    mockMessage.reply = vi.fn()

    vi.clearAllMocks()
  })

  it("should ignore non-DM messages", async () => {
    mockMessage.channel.type = ChannelType.GuildText

    await messageCreateEvent.onMessage([mockMessage])

    expect(mockMessage.reply).not.toHaveBeenCalled()
  })

  it("should ignore bot messages", async () => {
    mockMessage.author.bot = true

    await messageCreateEvent.onMessage([mockMessage])

    expect(mockMessage.reply).not.toHaveBeenCalled()
  })

  it("should handle invalid token", async () => {
    (decryptTokenString as any).mockReturnValue(null)

    await messageCreateEvent.onMessage([mockMessage])

    expect(mockMessage.reply).toHaveBeenCalled()
    const call = mockMessage.reply.mock.calls[0][0]
    expect(call.embeds[0].data.title).toContain("Invalid Token")
    expect(call.embeds[0].data.description).toContain("invalid")
  })

  it("should handle guild not found", async () => {
    (decryptTokenString as any).mockReturnValue({
      serverId: "guild-123",
      versionId: "01",
      roles: ["verified"],
    });

    (bot.guilds.fetch as any).mockResolvedValue(null)

    await messageCreateEvent.onMessage([mockMessage])

    expect(mockMessage.reply).toHaveBeenCalled()
    const call = mockMessage.reply.mock.calls[0][0]
    expect(call.embeds[0].data.title).toContain("Server Not Found")
    expect(call.embeds[0].data.description).toContain("could not be found")
  })

  it("should verify user successfully via DM", async () => {
    (decryptTokenString as any).mockReturnValue({
      serverId: "guild-123",
      versionId: "01",
      roles: ["verified"],
    });

    (bot.guilds.fetch as any).mockResolvedValue(mockGuild);
    (mockGuild.members.fetch as any).mockResolvedValue(mockMember);
    (mockUserManager.verifyUser as any).mockResolvedValue(["Verified"])

    await messageCreateEvent.onMessage([mockMessage])

    expect(mockUserManager.verifyUser).toHaveBeenCalledWith(mockMember, "test_token")
    expect(mockMessage.reply).toHaveBeenCalled()

    const call = mockMessage.reply.mock.calls[0][0]
    expect(call.embeds[0].data.title).toContain("Verification Successful")
    expect(call.embeds[0].data.description).toContain("verified")
    expect(call.embeds[0].data.description).toContain("Test Guild")
  })

  it("should handle user not in guild", async () => {
    (decryptTokenString as any).mockReturnValue({
      serverId: "guild-123",
      versionId: "01",
      roles: ["verified"],
    });

    (bot.guilds.fetch as any).mockResolvedValue(mockGuild);
    (mockGuild.members.fetch as any).mockResolvedValue(mockMember);
    // UserManager throws UserNotInGuildError
    (mockUserManager.verifyUser as any).mockRejectedValue(new UserNotInGuildError())

    await messageCreateEvent.onMessage([mockMessage])

    expect(mockMessage.reply).toHaveBeenCalled()
    const call = mockMessage.reply.mock.calls[0][0]
    expect(call.embeds[0].data.title).toContain("Verification Failed")
    expect(call.embeds[0].data.description).toContain("not a member of")
  })

  it("should handle token already used error", async () => {
    (decryptTokenString as any).mockReturnValue({
      serverId: "guild-123",
      versionId: "01",
      roles: ["verified"],
    });

    (bot.guilds.fetch as any).mockResolvedValue(mockGuild);
    (mockGuild.members.fetch as any).mockResolvedValue(mockMember);
    (mockUserManager.verifyUser as any).mockRejectedValue(new TokenAlreadyUsedError())

    await messageCreateEvent.onMessage([mockMessage])

    expect(mockMessage.reply).toHaveBeenCalled()
    const call = mockMessage.reply.mock.calls[0][0]
    expect(call.embeds[0].data.title).toContain("Verification Failed")
    expect(call.embeds[0].data.description).toContain("already been used")
  })

  it("should allow duplicate verification via DM", async () => {
    (decryptTokenString as any).mockReturnValue({
      serverId: "guild-123",
      versionId: "01",
      roles: ["verified", "tutor"],
    });

    (bot.guilds.fetch as any).mockResolvedValue(mockGuild);
    (mockGuild.members.fetch as any).mockResolvedValue(mockMember);
    (mockUserManager.verifyUser as any).mockResolvedValue(["Verified", "Tutor"])

    await messageCreateEvent.onMessage([mockMessage])

    expect(mockUserManager.verifyUser).toHaveBeenCalledWith(mockMember, "test_token")
    expect(mockMessage.reply).toHaveBeenCalled()

    const call = mockMessage.reply.mock.calls[0][0]
    expect(call.embeds[0].data.title).toContain("✅")
    expect(call.embeds[0].data.description).toContain("Verified")
    expect(call.embeds[0].data.description).toContain("Tutor")
  })

  it("should propagate errors when decryptTokenString throws", async () => {
    const error = new Error("Decryption failed");
    (decryptTokenString as any).mockImplementation(() => {
      throw error
    })

    // Currently, the handler doesn't wrap decryptTokenString in try-catch
    // so the error propagates and crashes the handler
    await expect(messageCreateEvent.onMessage([mockMessage])).rejects.toThrow("Decryption failed")
    expect(mockMessage.reply).not.toHaveBeenCalled()
  })
})
