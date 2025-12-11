import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { TutorVoiceClose } from "@commands/tutor/voice/close"
import { RoomManager } from "@managers/RoomManager"
import { CommandInteraction, GuildMember } from "discord.js"
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

describe("TutorVoiceClose", () => {
  let command: TutorVoiceClose
  let mockRoomManager: any
  let mockInteraction: any

  beforeEach(() => {
    mockRoomManager = mockDeep<RoomManager>()
    command = new TutorVoiceClose(mockRoomManager)

    mockInteraction = mockDeep<CommandInteraction>()
    mockInteraction.user = { id: "user-1", tag: "User#0001" }
    mockInteraction.guild = { id: "guild-1" }
    mockInteraction.deferReply = vi.fn()
    mockInteraction.reply = vi.fn()
    mockInteraction.editReply = vi.fn()

    // Default member setup
    mockInteraction.member = {
      voice: {
        channel: {
          id: "channel-1",
          name: "Temp Channel",
        },
      },
    } as unknown as GuildMember
  })

  it("should close ephemeral channel", async () => {
    mockRoomManager.isEphemeralChannel.mockResolvedValue(true)

    await command.close(mockInteraction)

    expect(mockInteraction.deferReply).toHaveBeenCalled()
    expect(mockRoomManager.kickAllMembers).toHaveBeenCalled()
    expect(mockRoomManager.deleteChannel).toHaveBeenCalled()
    expect(mockInteraction.editReply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([expect.objectContaining({ data: expect.objectContaining({ title: "Channel Closed" }) })]),
    }))
  })

  it("should fail if not in a server", async () => {
    mockInteraction.guild = null
    await command.close(mockInteraction)
    expect(mockInteraction.reply).not.toHaveBeenCalled()
  })

  it("should fail if user not in voice", async () => {
    (mockInteraction.member as any).voice.channel = null
    await command.close(mockInteraction)
    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({ embeds: expect.arrayContaining([expect.objectContaining({ data: expect.objectContaining({ title: "Error" }) })]) }))
  })

  it("should fail if channel is not ephemeral", async () => {
    mockRoomManager.isEphemeralChannel.mockResolvedValue(false)
    await command.close(mockInteraction)
    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({ embeds: expect.arrayContaining([expect.objectContaining({ data: expect.objectContaining({ title: "Error" }) })]) }))
  })

  it("should handle kickAllMembers rejection", async () => {
    mockRoomManager.isEphemeralChannel.mockResolvedValue(true)
    mockRoomManager.kickAllMembers.mockRejectedValue(new Error("Failed to kick members"))

    await command.close(mockInteraction)

    expect(mockInteraction.editReply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([expect.objectContaining({ data: expect.objectContaining({ title: "Error" }) })]),
    }))
  })

  it("should handle deleteChannel failure", async () => {
    mockRoomManager.isEphemeralChannel.mockResolvedValue(true)
    mockRoomManager.kickAllMembers.mockResolvedValue(undefined)
    mockRoomManager.deleteChannel.mockRejectedValue(new Error("Failed to delete channel"))

    await command.close(mockInteraction)

    expect(mockInteraction.editReply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([expect.objectContaining({ data: expect.objectContaining({ title: "Error" }) })]),
    }))
  })
})
