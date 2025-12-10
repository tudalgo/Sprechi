import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { AdminSessionTerminateAllCommand } from "@commands/admin/session/terminate-all"
import { QueueManager } from "@managers/QueueManager"
import { CommandInteraction } from "discord.js"
import { mockDeep } from "vitest-mock-extended"

describe("AdminSessionTerminateAllCommand", () => {
  let mockQueueManager: any
  let mockInteraction: any

  beforeEach(() => {
    mockQueueManager = mockDeep<QueueManager>()
    mockInteraction = mockDeep<CommandInteraction>()
    mockInteraction.guildId = "guild-123"
    mockInteraction.editReply = vi.fn()
    mockInteraction.deferReply = vi.fn()
  })

  it("should terminate all sessions", async () => {
    const command = new AdminSessionTerminateAllCommand(mockQueueManager)
    mockQueueManager.terminateAllSessions.mockResolvedValue(5)

    await command.terminateAll(mockInteraction)

    expect(mockQueueManager.terminateAllSessions).toHaveBeenCalledWith("guild-123")
    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              description: expect.stringContaining("Successfully terminated **5** session(s)"),
            }),
          }),
        ]),
      }),
    )
  })

  it("should show message if no active sessions", async () => {
    const command = new AdminSessionTerminateAllCommand(mockQueueManager)
    mockQueueManager.terminateAllSessions.mockResolvedValue(0)

    await command.terminateAll(mockInteraction)

    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              description: expect.stringContaining("No active sessions found"),
            }),
          }),
        ]),
      }),
    )
  })

  it("should return early if not in a guild", async () => {
    const command = new AdminSessionTerminateAllCommand(mockQueueManager)
    mockInteraction.guildId = null

    await command.terminateAll(mockInteraction)

    expect(mockInteraction.deferReply).not.toHaveBeenCalled()
  })

  it("should handle pluralization for single session", async () => {
    const command = new AdminSessionTerminateAllCommand(mockQueueManager)
    mockQueueManager.terminateAllSessions.mockResolvedValue(1)

    await command.terminateAll(mockInteraction)

    const replyCall = mockInteraction.editReply.mock.calls[0][0]
    const description = replyCall.embeds[0].data.description
    expect(description).toContain("Successfully terminated **1** session(s)")
  })

  it("should handle terminateAllSessions throwing an error", async () => {
    const command = new AdminSessionTerminateAllCommand(mockQueueManager)
    mockQueueManager.terminateAllSessions.mockRejectedValue(new Error("Database error"))

    await expect(command.terminateAll(mockInteraction)).rejects.toThrow("Database error")
    expect(mockQueueManager.terminateAllSessions).toHaveBeenCalledWith("guild-123")
  })
})
