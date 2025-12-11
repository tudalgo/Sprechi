import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { AdminQueueWaitingRoom } from "@commands/admin/queue/waiting-room"
import { QueueManager } from "@managers/QueueManager"
import { CommandInteraction, MessageFlags, Colors, VoiceChannel } from "discord.js"
import { mockDeep } from "vitest-mock-extended"
import { QueueNotFoundError } from "@errors/QueueErrors"

// Mock QueueManager
vi.mock("@managers/QueueManager")

// Mock logger
vi.mock("@utils/logger", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe("AdminQueueWaitingRoom", () => {
  let adminQueueWaitingRoom: AdminQueueWaitingRoom
  let mockQueueManager: any
  let mockInteraction: any
  let mockChannel: any

  beforeEach(() => {
    mockQueueManager = mockDeep<QueueManager>();
    (QueueManager as any).mockImplementation(function () {
      return mockQueueManager
    })

    adminQueueWaitingRoom = new AdminQueueWaitingRoom(mockQueueManager)

    mockInteraction = mockDeep<CommandInteraction>()
    mockInteraction.user = { tag: "testuser", id: "user-123" }
    mockInteraction.guild = { id: "guild-123", name: "Test Guild" }
    mockInteraction.reply = vi.fn()

    mockChannel = mockDeep<VoiceChannel>()
    mockChannel.id = "channel-123"
    mockChannel.name = "Waiting Room"
  })

  it("should set waiting room successfully", async () => {
    const queueName = "test-queue"

    mockQueueManager.setWaitingRoom.mockResolvedValue(undefined)

    await adminQueueWaitingRoom.setWaitingRoom(queueName, mockChannel, mockInteraction)

    expect(mockQueueManager.setWaitingRoom).toHaveBeenCalledWith("guild-123", queueName, "channel-123")
    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: "Waiting Room Set",
            description: `Waiting room for queue **${queueName}** set to <#${mockChannel.id}>.`,
            color: Colors.Green,
          }),
        }),
      ]),
      flags: MessageFlags.Ephemeral,
    }))
  })

  it("should handle queue not found error", async () => {
    const queueName = "non-existent-queue"

    mockQueueManager.setWaitingRoom.mockRejectedValue(new QueueNotFoundError(queueName))

    await adminQueueWaitingRoom.setWaitingRoom(queueName, mockChannel, mockInteraction)

    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: "Error",
            description: `Queue **${queueName}** not found.`,
          }),
        }),
      ]),
      flags: MessageFlags.Ephemeral,
    }))
  })

  it("should handle generic errors", async () => {
    const queueName = "error-queue"

    mockQueueManager.setWaitingRoom.mockRejectedValue(new Error("Database error"))

    await adminQueueWaitingRoom.setWaitingRoom(queueName, mockChannel, mockInteraction)

    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: "Error",
            description: "Failed to set waiting room.",
          }),
        }),
      ]),
      flags: MessageFlags.Ephemeral,
    }))
  })

  it("should not allow command outside of guild", async () => {
    mockInteraction.guild = null

    await adminQueueWaitingRoom.setWaitingRoom("name", mockChannel, mockInteraction)

    expect(mockInteraction.reply).not.toHaveBeenCalled()
  })
})
