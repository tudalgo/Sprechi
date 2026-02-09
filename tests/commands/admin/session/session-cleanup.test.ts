import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { AdminSessionCleanupCommand } from "@commands/admin/session/session-cleanup"
import { QueueManager } from "@managers/QueueManager"
import { CommandInteraction } from "discord.js"
import { mockDeep } from "vitest-mock-extended"

describe("AdminSessionCleanupCommand", () => {
  let mockQueueManager: any
  let mockInteraction: any

  beforeEach(() => {
    mockQueueManager = mockDeep<QueueManager>()
    mockInteraction = mockDeep<CommandInteraction>()
    mockInteraction.guildId = "guild-123"
    mockInteraction.editReply = vi.fn()
    mockInteraction.deferReply = vi.fn()
  })

  it("should set cleanup schedule successfully", async () => {
    const command = new AdminSessionCleanupCommand(mockQueueManager)
    mockQueueManager.parseDayOfWeek.mockReturnValue(0) // Sunday

    await command.cleanup("Sunday", "23:00", undefined, mockInteraction)

    expect(mockQueueManager.parseDayOfWeek).toHaveBeenCalledWith("Sunday")
    expect(mockQueueManager.validateTimeFormat).toHaveBeenCalledWith("23:00")
    expect(mockQueueManager.setSessionCleanupSchedule).toHaveBeenCalledWith("guild-123", 0, "23:00")
    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              description: expect.stringContaining("Sunday"),
            }),
          }),
        ]),
      }),
    )
  })

  it("should disable cleanup schedule when disable flag is set", async () => {
    const command = new AdminSessionCleanupCommand(mockQueueManager)

    await command.cleanup(undefined, undefined, true, mockInteraction)

    expect(mockQueueManager.disableSessionCleanupSchedule).toHaveBeenCalledWith("guild-123")
    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              description: expect.stringContaining("disabled"),
            }),
          }),
        ]),
      }),
    )
  })

  it("should show error when day is provided but time is missing", async () => {
    const command = new AdminSessionCleanupCommand(mockQueueManager)

    await command.cleanup("Sunday", undefined, undefined, mockInteraction)

    expect(mockQueueManager.setSessionCleanupSchedule).not.toHaveBeenCalled()
    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              description: expect.stringContaining("Please provide both"),
            }),
          }),
        ]),
      }),
    )
  })

  it("should show error when time is provided but day is missing", async () => {
    const command = new AdminSessionCleanupCommand(mockQueueManager)

    await command.cleanup(undefined, "23:00", undefined, mockInteraction)

    expect(mockQueueManager.setSessionCleanupSchedule).not.toHaveBeenCalled()
    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              description: expect.stringContaining("Please provide both"),
            }),
          }),
        ]),
      }),
    )
  })

  it("should show error on invalid day", async () => {
    const command = new AdminSessionCleanupCommand(mockQueueManager)
    mockQueueManager.parseDayOfWeek.mockImplementation(() => {
      throw new Error("Invalid day of week")
    })

    await command.cleanup("InvalidDay", "23:00", undefined, mockInteraction)

    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              description: expect.stringContaining("Invalid day"),
            }),
          }),
        ]),
      }),
    )
  })

  it("should show error on invalid time format", async () => {
    const command = new AdminSessionCleanupCommand(mockQueueManager)
    mockQueueManager.parseDayOfWeek.mockReturnValue(0)
    mockQueueManager.validateTimeFormat.mockImplementation(() => {
      throw new Error("Invalid time format")
    })

    await command.cleanup("Sunday", "invalid", undefined, mockInteraction)

    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              description: expect.stringContaining("Invalid time"),
            }),
          }),
        ]),
      }),
    )
  })

  it("should return early if not in a guild", async () => {
    const command = new AdminSessionCleanupCommand(mockQueueManager)
    mockInteraction.guildId = null

    await command.cleanup("Sunday", "23:00", undefined, mockInteraction)

    expect(mockInteraction.deferReply).not.toHaveBeenCalled()
  })
})
