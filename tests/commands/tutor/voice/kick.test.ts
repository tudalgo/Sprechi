import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { TutorVoiceKick } from "@commands/tutor/voice/kick"
import { RoomManager } from "@managers/RoomManager"
import { CommandInteraction, GuildMember, User } from "discord.js"
import { mockDeep } from "vitest-mock-extended"

// Mock RoomManager
vi.mock("@managers/RoomManager")

// Mock logger
vi.mock("@utils/logger", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe("TutorVoiceKick", () => {
  let command: TutorVoiceKick
  let mockRoomManager: any
  let mockInteraction: any
  let mockTargetUser: User

  beforeEach(() => {
    mockRoomManager = mockDeep<RoomManager>()
    command = new TutorVoiceKick(mockRoomManager)

    mockTargetUser = { id: "target-1", tag: "Target#0001" } as User

    mockInteraction = mockDeep<CommandInteraction>()
    mockInteraction.user = { id: "user-1", tag: "User#0001" }
    mockInteraction.guild = { id: "guild-1" }
    mockInteraction.deferReply = vi.fn()
    mockInteraction.reply = vi.fn()
    mockInteraction.editReply = vi.fn()

    // Default member setup with mock channel members
    const mockChannel = {
      id: "channel-1",
      name: "Temp Channel",
      members: {
        get: vi.fn().mockImplementation(id => id === "target-1" ? {} : undefined),
      },
    }

    mockInteraction.member = {
      voice: {
        channel: mockChannel,
      },
    } as unknown as GuildMember
  })

  it("should kick user from channel", async () => {
    mockRoomManager.isEphemeralChannel.mockResolvedValue(true)
    await command.kick(mockTargetUser, mockInteraction)

    expect(mockInteraction.deferReply).toHaveBeenCalled()
    expect(mockRoomManager.kickUser).toHaveBeenCalled()
    expect(mockInteraction.editReply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([expect.objectContaining({ data: expect.objectContaining({ title: "User Kicked" }) })]),
    }))
  })

  it("should fail if not in a server", async () => {
    mockInteraction.guild = null
    await command.kick(mockTargetUser, mockInteraction)
    expect(mockInteraction.reply).not.toHaveBeenCalled()
  })

  it("should fail if user not in voice", async () => {
    (mockInteraction.member as any).voice.channel = null
    await command.kick(mockTargetUser, mockInteraction)
    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({ embeds: expect.arrayContaining([expect.objectContaining({ data: expect.objectContaining({ title: "Error" }) })]) }))
  })

  it("should fail if target user is not in channel", async () => {
    const channel = (mockInteraction.member as any).voice.channel
    channel.members.get.mockReturnValue(undefined)

    await command.kick(mockTargetUser, mockInteraction)

    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({ embeds: expect.arrayContaining([expect.objectContaining({ data: expect.objectContaining({ description: expect.stringContaining("not in your voice channel") }) })]) }))
  })

  it("should fail if channel is not ephemeral", async () => {
    mockRoomManager.isEphemeralChannel.mockResolvedValue(false)
    await command.kick(mockTargetUser, mockInteraction)
    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({ embeds: expect.arrayContaining([expect.objectContaining({ data: expect.objectContaining({ title: "Error" }) })]) }))
  })

  it("should handle kickUser rejection", async () => {
    mockRoomManager.isEphemeralChannel.mockResolvedValue(true)
    mockRoomManager.kickUser.mockRejectedValue(new Error("Failed to kick user"))

    await command.kick(mockTargetUser, mockInteraction)

    expect(mockInteraction.editReply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([expect.objectContaining({ data: expect.objectContaining({ title: "Error" }) })]),
    }))
  })

  it("should ensure responses remain ephemeral", async () => {
    mockRoomManager.isEphemeralChannel.mockResolvedValue(true)

    await command.kick(mockTargetUser, mockInteraction)

    expect(mockInteraction.deferReply).toHaveBeenCalledWith({ flags: expect.any(Number) })
  })
})
