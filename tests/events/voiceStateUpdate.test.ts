import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { VoiceStateUpdate } from "@events/voiceStateUpdate"
import { QueueManager } from "@managers/QueueManager"
import { VoiceState } from "discord.js"
import { mockDeep } from "vitest-mock-extended"
import { TutorCannotJoinQueueError } from "@errors/QueueErrors"
import db from "@db"
import { sessionStudents } from "@db/schema"

// Mock QueueManager
vi.mock("@managers/QueueManager")
// Mock DmManager
vi.mock("@managers/DmManager")

// Mock db
vi.mock("@db", () => ({
  default: {
    select: vi.fn(),
    update: vi.fn(),
  },
  sessionStudents: {
    channelId: "channelId",
    endTime: "endTime",
    id: "id",
  },
}))

// Mock logger
vi.mock("@utils/logger", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe("VoiceStateUpdate", () => {
  let voiceStateUpdate: VoiceStateUpdate
  let mockQueueManager: any
  let mockDmManager: any
  let mockOldState: any
  let mockNewState: any

  beforeEach(() => {
    mockQueueManager = mockDeep<QueueManager>();
    (QueueManager as any).mockImplementation(function () {
      return mockQueueManager
    })

    mockDmManager = mockDeep();

    voiceStateUpdate = new VoiceStateUpdate(mockQueueManager, mockDmManager)

    mockOldState = mockDeep<VoiceState>()
    mockNewState = mockDeep<VoiceState>()
    mockNewState.guild = { id: "guild-123" }
    mockOldState.guild = { id: "guild-123" }
    mockNewState.member = { id: "user-123", user: { tag: "user", username: "testuser" } }
    mockOldState.member = { id: "user-123", user: { tag: "user", username: "testuser" } }
    mockNewState.disconnect = vi.fn().mockResolvedValue(undefined)

    vi.clearAllMocks()
  })

  describe("auto-join", () => {
    it("should auto-join queue when entering waiting room", async () => {
      mockOldState.channelId = null
      mockNewState.channelId = "waiting-room-123"

      const mockQueue = { name: "test-queue" }
      mockQueueManager.getQueueByWaitingRoom.mockResolvedValue(mockQueue)

      await voiceStateUpdate.voiceStateUpdate([mockOldState, mockNewState])

      expect(mockQueueManager.getQueueByWaitingRoom).toHaveBeenCalledWith("guild-123", "waiting-room-123")
      expect(mockQueueManager.joinQueue).toHaveBeenCalledWith("guild-123", "test-queue", "user-123")
    })

    it("should not auto-join if not a waiting room", async () => {
      mockOldState.channelId = null
      mockNewState.channelId = "other-channel"

      mockQueueManager.getQueueByWaitingRoom.mockResolvedValue(null)

      await voiceStateUpdate.voiceStateUpdate([mockOldState, mockNewState])

      expect(mockQueueManager.joinQueue).not.toHaveBeenCalled()
    })

    it("should silently ignore tutor with active session joining waiting room", async () => {
      mockOldState.channelId = null
      mockNewState.channelId = "waiting-room-123"

      const mockQueue = { name: "test-queue" }
      mockQueueManager.getQueueByWaitingRoom.mockResolvedValue(mockQueue)
      mockQueueManager.joinQueue.mockRejectedValue(new TutorCannotJoinQueueError())

      await voiceStateUpdate.voiceStateUpdate([mockOldState, mockNewState])

      expect(mockQueueManager.getQueueByWaitingRoom).toHaveBeenCalledWith("guild-123", "waiting-room-123")
      expect(mockQueueManager.joinQueue).toHaveBeenCalledWith("guild-123", "test-queue", "user-123")
      // Should not throw or log error for TutorCannotJoinQueueError
    })
  })

  describe("auto-leave", () => {
    it("should auto-leave queue when leaving waiting room", async () => {
      mockOldState.channelId = "waiting-room-123"
      mockNewState.channelId = null

      const mockQueue = { name: "test-queue" }
      mockQueueManager.getQueueByWaitingRoom.mockResolvedValue(mockQueue)

      // Mock db select for cleanup (return empty to skip cleanup logic)
      const whereMock = vi.fn().mockResolvedValue([])
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock })

      await voiceStateUpdate.voiceStateUpdate([mockOldState, mockNewState])

      expect(mockQueueManager.getQueueByWaitingRoom).toHaveBeenCalledWith("guild-123", "waiting-room-123")
      expect(mockQueueManager.leaveQueue).toHaveBeenCalledWith("guild-123", "test-queue", "user-123")
    })

    it("should disconnect user and send DM when queue is locked", async () => {
      mockOldState.channelId = null
      mockNewState.channelId = "waiting-room-123"

      const mockQueue = { name: "test-queue" }
      const { QueueLockedError } = await import("@errors/QueueErrors")
      mockQueueManager.getQueueByWaitingRoom.mockResolvedValue(mockQueue)
      mockQueueManager.joinQueue.mockRejectedValue(new QueueLockedError("test-queue"))
      mockDmManager.sendDm.mockResolvedValue(true)

      await voiceStateUpdate.voiceStateUpdate([mockOldState, mockNewState])

      // Should disconnect the user
      expect(mockNewState.disconnect).toHaveBeenCalled()

      // Should send DM with embed explaining queue is locked
      expect(mockDmManager.sendDm).toHaveBeenCalledWith(
        mockNewState.client,
        "user-123",
        expect.objectContaining({
          data: expect.objectContaining({
            title: "Queue Locked",
            description: expect.stringContaining("locked"),
          }),
        })
      )
    })
  })

  describe("ephemeral channel cleanup", () => {
    it("should delete empty ephemeral channel", async () => {
      mockOldState.channelId = "ephemeral-channel-123"
      mockNewState.channelId = null

      mockQueueManager.getQueueByWaitingRoom.mockResolvedValue(null)

      const mockSessionStudent = { id: "session-student-123" }
      // Mock db select
      const whereMock = vi.fn().mockResolvedValue([mockSessionStudent])
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock })

      // Mock channel empty
      const mockChannel = {
        id: "ephemeral-channel-123",
        name: "Session-User",
        members: { size: 0 },
        delete: vi.fn().mockResolvedValue(undefined),
      }
      mockOldState.channel = mockChannel

      // Mock db update
      const whereUpdateMock = vi.fn().mockResolvedValue([])
      const setMock = vi.fn().mockReturnValue({ where: whereUpdateMock });
      (db.update as any).mockReturnValue({ set: setMock })

      await voiceStateUpdate.voiceStateUpdate([mockOldState, mockNewState])

      expect(mockChannel.delete).toHaveBeenCalled()
      expect(db.update).toHaveBeenCalledWith(sessionStudents)
    })

    it("should not delete non-empty ephemeral channel", async () => {
      mockOldState.channelId = "ephemeral-channel-123"
      mockNewState.channelId = null

      mockQueueManager.getQueueByWaitingRoom.mockResolvedValue(null)

      const mockSessionStudent = { id: "session-student-123" }
      // Mock db select
      const whereMock = vi.fn().mockResolvedValue([mockSessionStudent])
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock })

      // Mock channel not empty
      const mockChannel = {
        id: "ephemeral-channel-123",
        name: "Session-User",
        members: { size: 1 },
        delete: vi.fn(),
      }
      mockOldState.channel = mockChannel

      await voiceStateUpdate.voiceStateUpdate([mockOldState, mockNewState])

      expect(mockChannel.delete).not.toHaveBeenCalled()
    })

    it("should handle DB select failure during cleanup", async () => {
      mockOldState.channelId = "ephemeral-channel-123"
      mockNewState.channelId = null
      mockQueueManager.getQueueByWaitingRoom.mockResolvedValue(null)

      // Mock db select to throw
      const whereMock = vi.fn().mockRejectedValue(new Error("Database error"))
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock })

      const mockChannel = {
        id: "ephemeral-channel-123",
        name: "Session-User",
        members: { size: 0 },
        delete: vi.fn(),
      }
      mockOldState.channel = mockChannel

      // Should not crash
      await expect(voiceStateUpdate.voiceStateUpdate([mockOldState, mockNewState])).resolves.not.toThrow()

      // Channel should not be deleted if DB fails
      expect(mockChannel.delete).not.toHaveBeenCalled()
    })

    it("should handle DB update failure during cleanup", async () => {
      mockOldState.channelId = "ephemeral-channel-123"
      mockNewState.channelId = null
      mockQueueManager.getQueueByWaitingRoom.mockResolvedValue(null)

      const mockSessionStudent = { id: "session-student-123" }
      const whereMock = vi.fn().mockResolvedValue([mockSessionStudent])
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock })

      const mockChannel = {
        id: "ephemeral-channel-123",
        name: "Session-User",
        members: { size: 0 },
        delete: vi.fn().mockResolvedValue(undefined),
      }
      mockOldState.channel = mockChannel

      // Mock db update to throw
      const whereUpdateMock = vi.fn().mockRejectedValue(new Error("Update failed"))
      const setMock = vi.fn().mockReturnValue({ where: whereUpdateMock });
      (db.update as any).mockReturnValue({ set: setMock })

      // Should not crash even if update fails
      await expect(voiceStateUpdate.voiceStateUpdate([mockOldState, mockNewState])).resolves.not.toThrow()

      // Channel should still be deleted
      expect(mockChannel.delete).toHaveBeenCalled()
    })
  })
})
