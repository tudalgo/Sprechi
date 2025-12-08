import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { AdminQueueLogChannelPrivate } from "@commands/admin/queue/log_channel/set_private"
import { QueueManager } from "@managers/QueueManager"
import { CommandInteraction, TextChannel } from "discord.js"
import { mockDeep } from "vitest-mock-extended"
import { QueueNotFoundError } from "@errors/QueueErrors"

describe("AdminQueueLogChannelPrivate", () => {
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

  it("should set private log channel successfully", async () => {
    const command = new AdminQueueLogChannelPrivate(mockQueueManager)
    mockQueueManager.setPrivateLogChannel.mockResolvedValue(undefined)

    await command.setPrivateLogChannel("test-queue", mockChannel, mockInteraction)

    expect(mockQueueManager.setPrivateLogChannel).toHaveBeenCalledWith("guild-123", "test-queue", "channel-123")
    expect(mockInteraction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "Private Log Channel Set",
            }),
          }),
        ]),
      }),
    )
  })

  it("should fail if queue is not found", async () => {
    const command = new AdminQueueLogChannelPrivate(mockQueueManager)
    mockQueueManager.setPrivateLogChannel.mockRejectedValue(new QueueNotFoundError("test-queue"))

    await command.setPrivateLogChannel("test-queue", mockChannel, mockInteraction)

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
