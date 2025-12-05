import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { TutorQueueSummary } from "@commands/tutor/queue/summary"
import { QueueManager } from "@managers/QueueManager"
import { CommandInteraction, MessageFlags, Colors } from "discord.js"
import { mockDeep } from "vitest-mock-extended"

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

describe("TutorQueueSummary", () => {
  let tutorQueueSummary: TutorQueueSummary
  let mockQueueManager: any
  let mockInteraction: any

  beforeEach(() => {
    mockQueueManager = mockDeep<QueueManager>();
    (QueueManager as any).mockImplementation(function () {
      return mockQueueManager
    })

    tutorQueueSummary = new TutorQueueSummary(mockQueueManager)

    mockInteraction = mockDeep<CommandInteraction>()
    mockInteraction.user = { tag: "tutor", id: "tutor-123" }
    mockInteraction.guild = { id: "guild-123", name: "Test Guild" }
    mockInteraction.reply = vi.fn()
  })

  it("should show queue summary successfully", async () => {
    const mockSession = { queue: { id: "queue-1", name: "test-queue", description: "Test Description" } }
    const mockQueueStats = { id: "queue-1", name: "test-queue", memberCount: 5, sessionCount: 2 }

    mockQueueManager.getActiveSession.mockResolvedValue(mockSession)
    mockQueueManager.listQueues.mockResolvedValue([mockQueueStats])

    await tutorQueueSummary.summary(mockInteraction)

    expect(mockQueueManager.getActiveSession).toHaveBeenCalledWith("guild-123", "tutor-123")
    expect(mockQueueManager.listQueues).toHaveBeenCalledWith("guild-123")
    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: "Queue Summary: test-queue",
            description: "Test Description",
            fields: expect.arrayContaining([
              expect.objectContaining({ name: "Students in Queue", value: "5" }),
              expect.objectContaining({ name: "Active Sessions", value: "2" }),
            ]),
            color: Colors.Blue,
          }),
        }),
      ]),
      flags: MessageFlags.Ephemeral,
    }))
  })

  it("should handle queue not found in stats", async () => {
    const mockSession = { queue: { id: "queue-1", name: "test-queue" } }

    mockQueueManager.getActiveSession.mockResolvedValue(mockSession)
    mockQueueManager.listQueues.mockResolvedValue([])

    await tutorQueueSummary.summary(mockInteraction)

    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: "Error",
            description: "Queue not found.",
          }),
        }),
      ]),
      flags: MessageFlags.Ephemeral,
    }))
  })

  it("should handle no active session", async () => {
    mockQueueManager.getActiveSession.mockResolvedValue(null)

    await tutorQueueSummary.summary(mockInteraction)

    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: "Error",
            description: "You do not have an active session.",
          }),
        }),
      ]),
      flags: MessageFlags.Ephemeral,
    }))
  })
})
