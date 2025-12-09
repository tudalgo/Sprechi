import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { AdminQueueLogChannelPublic } from "@commands/admin/queue/log_channel/set_public"
import { QueueManager } from "@managers/QueueManager"
import { CommandInteraction, TextChannel } from "discord.js"
import { mockDeep } from "vitest-mock-extended"
import { QueueNotFoundError } from "@errors/QueueErrors"

// Mock logger
vi.mock("@utils/logger", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe("AdminQueueLogChannelPublic", () => {
  let mockQueueManager: any
  let mockInteraction: any
  let mockChannel: any

  beforeEach(() => {
    mockQueueManager = mockDeep<QueueManager>()
    mockInteraction = mockDeep<CommandInteraction>()
    mockInteraction.guildId = "guild-123"
    mockInteraction.guild = { id: "guild-123", name: "Test Guild" }
    mockInteraction.user = { id: "user-123", username: "testuser" }
    mockInteraction.reply = vi.fn()

    mockChannel = mockDeep<TextChannel>()
    mockChannel.id = "channel-123"
    mockChannel.name = "logs"
  })

  it("should set public log channel successfully", async () => {
    const command = new AdminQueueLogChannelPublic(mockQueueManager)
    mockQueueManager.setPublicLogChannel.mockResolvedValue(undefined)

    await command.setPublicLogChannel("test-queue", mockChannel, mockInteraction)

    expect(mockQueueManager.setPublicLogChannel).toHaveBeenCalledWith("guild-123", "test-queue", "channel-123")
    expect(mockInteraction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "Public Log Channel Set",
            }),
          }),
        ]),
      }),
    )
  })

  it("should fail if queue is not found", async () => {
    const command = new AdminQueueLogChannelPublic(mockQueueManager)
    mockQueueManager.setPublicLogChannel.mockRejectedValue(new QueueNotFoundError("test-queue"))

    await command.setPublicLogChannel("test-queue", mockChannel, mockInteraction)

    expect(mockInteraction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "Error",
            }),
          }),
        ]),
      }),
    )
  })
})
