import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { TutorSessionEnd } from "@commands/tutor/session/end"
import { QueueManager } from "@managers/QueueManager"
import { CommandInteraction, MessageFlags, Colors } from "discord.js"
import { mockDeep } from "vitest-mock-extended"
import { QueueError } from "@errors/QueueErrors"

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

describe("TutorSessionEnd", () => {
  let tutorSessionEnd: TutorSessionEnd
  let mockQueueManager: any
  let mockInteraction: any

  beforeEach(() => {
    mockQueueManager = mockDeep<QueueManager>();
    (QueueManager as any).mockImplementation(function () {
      return mockQueueManager
    })

    tutorSessionEnd = new TutorSessionEnd(mockQueueManager)

    mockInteraction = mockDeep<CommandInteraction>()
    mockInteraction.user = { tag: "tutor", id: "tutor-123" }
    mockInteraction.guild = { id: "guild-123", name: "Test Guild" }
    mockInteraction.reply = vi.fn()
  })

  it("should end a session successfully", async () => {
    mockQueueManager.endSession.mockResolvedValue(undefined)

    await tutorSessionEnd.end(mockInteraction)

    expect(mockQueueManager.endSession).toHaveBeenCalledWith("guild-123", "tutor-123")
    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: "Session Ended",
            description: "You have ended your session.",
            color: Colors.Yellow,
          }),
        }),
      ]),
      flags: MessageFlags.Ephemeral,
    }))
  })

  it("should handle errors during session end", async () => {
    mockQueueManager.endSession.mockRejectedValue(new Error("Failed to end session"))

    await tutorSessionEnd.end(mockInteraction)

    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: "Error",
            description: "Failed to end session",
          }),
        }),
      ]),
      flags: MessageFlags.Ephemeral,
    }))
  })

  it("should handle no active session", async () => {
    mockQueueManager.endSession.mockRejectedValue(new QueueError("You do not have an active session."))

    await tutorSessionEnd.end(mockInteraction)

    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: "Error",
            description: "You do not have an active session.",
          }),
        }),
      ]),
    }))
  })

  it("should not allow command outside of guild", async () => {
    mockInteraction.guild = null

    await tutorSessionEnd.end(mockInteraction)

    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: "This command can only be used in a server.",
      flags: MessageFlags.Ephemeral,
    })
  })
})
