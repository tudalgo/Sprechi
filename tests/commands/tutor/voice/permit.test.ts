import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { TutorVoicePermit } from "@commands/tutor/voice/permit"
import { QueueManager } from "@managers/QueueManager"
import { RoomManager } from "@managers/RoomManager"
import { CommandInteraction, GuildMember, User } from "discord.js"
import { mockDeep } from "vitest-mock-extended"

// Mock QueueManager
vi.mock("@managers/QueueManager")

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

describe("TutorVoicePermit", () => {
  let command: TutorVoicePermit
  let mockRoomManager: any
  let mockQueueManager: any
  let mockInteraction: any
  let mockTargetUser: User

  beforeEach(() => {
    mockRoomManager = mockDeep<RoomManager>()
    mockQueueManager = mockDeep<QueueManager>()
    command = new TutorVoicePermit(mockRoomManager, mockQueueManager)

    mockTargetUser = { id: "target-1", tag: "Target#0001" } as User

    mockInteraction = mockDeep<CommandInteraction>()
    mockInteraction.user = { id: "user-1", tag: "User#0001" }
    mockInteraction.guild = { id: "guild-1" }
    mockInteraction.deferReply = vi.fn()
    mockInteraction.reply = vi.fn()
    mockInteraction.editReply = vi.fn()

    mockInteraction.member = {
      voice: {
        channel: {
          id: "channel-1",
          name: "Temp Channel",
        },
      },
    } as unknown as GuildMember
  })

  it("should permit user and pick from queue if applicable", async () => {
    mockRoomManager.isEphemeralChannel.mockResolvedValue(true)
    mockRoomManager.permitUser.mockResolvedValue(true)
    mockRoomManager.getSessionIdFromChannel.mockResolvedValue("session-123")
    mockQueueManager.getQueueByUser.mockResolvedValue({ name: "queue-1" })

    await command.permit(mockTargetUser, mockInteraction)

    expect(mockRoomManager.permitUser).toHaveBeenCalled()
    expect(mockQueueManager.pickStudent).toHaveBeenCalledWith(
      "guild-1",
      "queue-1",
      "target-1",
      "session-123",
      "user-1",
      "channel-1",
    )
    expect(mockInteraction.editReply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            description: expect.stringContaining("Also picked from queue"),
          }),
        }),
      ]),
    }))
  })

  it("should only permit user if not in queue", async () => {
    mockRoomManager.isEphemeralChannel.mockResolvedValue(true)
    mockRoomManager.permitUser.mockResolvedValue(true)
    mockRoomManager.getSessionIdFromChannel.mockResolvedValue("session-123")
    mockQueueManager.getQueueByUser.mockResolvedValue(null)

    await command.permit(mockTargetUser, mockInteraction)

    expect(mockRoomManager.permitUser).toHaveBeenCalled()
    expect(mockQueueManager.pickStudent).not.toHaveBeenCalled()
    expect(mockInteraction.editReply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            description: expect.not.stringContaining("Also picked from queue"),
          }),
        }),
      ]),
    }))
  })

  it("should fail if not in a server", async () => {
    mockInteraction.guild = null
    await command.permit(mockTargetUser, mockInteraction)
    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining("only be used in a server") }))
  })

  it("should fail if user not in voice", async () => {
    (mockInteraction.member as any).voice.channel = null
    await command.permit(mockTargetUser, mockInteraction)
    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({ embeds: expect.arrayContaining([expect.objectContaining({ data: expect.objectContaining({ title: "Error" }) })]) }))
  })

  it("should fail if channel is not ephemeral", async () => {
    mockRoomManager.isEphemeralChannel.mockResolvedValue(false)
    await command.permit(mockTargetUser, mockInteraction)
    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({ embeds: expect.arrayContaining([expect.objectContaining({ data: expect.objectContaining({ title: "Error" }) })]) }))
  })
})
