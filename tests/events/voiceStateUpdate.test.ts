import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VoiceStateUpdate } from '@events/voiceStateUpdate';
import { QueueManager } from '@managers/QueueManager';
import { VoiceState } from 'discord.js';
import { mockDeep } from 'vitest-mock-extended';
import { AlreadyInQueueError, TutorCannotJoinQueueError } from '@errors/QueueErrors';
import db from '@db';
import { sessionStudents } from '@db/schema';

// Mock QueueManager
vi.mock('@managers/QueueManager');

// Mock db
vi.mock('@db', () => ({
  default: {
    select: vi.fn(),
    update: vi.fn(),
  },
  sessionStudents: {
    channelId: 'channelId',
    endTime: 'endTime',
    id: 'id',
  },
}));

// Mock logger
vi.mock('@utils/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('VoiceStateUpdate', () => {
  let voiceStateUpdate: VoiceStateUpdate;
  let mockQueueManager: any;
  let mockOldState: any;
  let mockNewState: any;

  beforeEach(() => {
    mockQueueManager = mockDeep<QueueManager>();
    (QueueManager as any).mockImplementation(function () { return mockQueueManager });

    voiceStateUpdate = new VoiceStateUpdate();
    // Manually inject the mock
    (voiceStateUpdate as any).queueManager = mockQueueManager;

    mockOldState = mockDeep<VoiceState>();
    mockNewState = mockDeep<VoiceState>();
    mockNewState.guild = { id: 'guild-123' };
    mockOldState.guild = { id: 'guild-123' };
    mockNewState.member = { id: 'user-123', user: { tag: 'user' } };
    mockOldState.member = { id: 'user-123', user: { tag: 'user' } };

    vi.clearAllMocks();
  });

  describe('auto-join', () => {
    it('should auto-join queue when entering waiting room', async () => {
      mockOldState.channelId = null;
      mockNewState.channelId = 'waiting-room-123';

      const mockQueue = { name: 'test-queue' };
      mockQueueManager.getQueueByWaitingRoom.mockResolvedValue(mockQueue);

      await voiceStateUpdate.voiceStateUpdate([mockOldState, mockNewState]);

      expect(mockQueueManager.getQueueByWaitingRoom).toHaveBeenCalledWith('guild-123', 'waiting-room-123');
      expect(mockQueueManager.joinQueue).toHaveBeenCalledWith('guild-123', 'test-queue', 'user-123');
    });

    it('should not auto-join if not a waiting room', async () => {
      mockOldState.channelId = null;
      mockNewState.channelId = 'other-channel';

      mockQueueManager.getQueueByWaitingRoom.mockResolvedValue(null);

      await voiceStateUpdate.voiceStateUpdate([mockOldState, mockNewState]);

      expect(mockQueueManager.joinQueue).not.toHaveBeenCalled();
    });

    it('should silently ignore tutor with active session joining waiting room', async () => {
      mockOldState.channelId = null;
      mockNewState.channelId = 'waiting-room-123';

      const mockQueue = { name: 'test-queue' };
      mockQueueManager.getQueueByWaitingRoom.mockResolvedValue(mockQueue);
      mockQueueManager.joinQueue.mockRejectedValue(new TutorCannotJoinQueueError());

      await voiceStateUpdate.voiceStateUpdate([mockOldState, mockNewState]);

      expect(mockQueueManager.getQueueByWaitingRoom).toHaveBeenCalledWith('guild-123', 'waiting-room-123');
      expect(mockQueueManager.joinQueue).toHaveBeenCalledWith('guild-123', 'test-queue', 'user-123');
      // Should not throw or log error for TutorCannotJoinQueueError
    });
  });

  describe('auto-leave', () => {
    it('should auto-leave queue when leaving waiting room', async () => {
      mockOldState.channelId = 'waiting-room-123';
      mockNewState.channelId = null;

      const mockQueue = { name: 'test-queue' };
      mockQueueManager.getQueueByWaitingRoom.mockResolvedValue(mockQueue);

      // Mock db select for cleanup (return empty to skip cleanup logic)
      const whereMock = vi.fn().mockResolvedValue([]);
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock });

      await voiceStateUpdate.voiceStateUpdate([mockOldState, mockNewState]);

      expect(mockQueueManager.getQueueByWaitingRoom).toHaveBeenCalledWith('guild-123', 'waiting-room-123');
      expect(mockQueueManager.leaveQueue).toHaveBeenCalledWith('guild-123', 'test-queue', 'user-123');
    });
  });

  describe('ephemeral channel cleanup', () => {
    it('should delete empty ephemeral channel', async () => {
      mockOldState.channelId = 'ephemeral-channel-123';
      mockNewState.channelId = null;

      mockQueueManager.getQueueByWaitingRoom.mockResolvedValue(null);

      const mockSessionStudent = { id: 'session-student-123' };
      // Mock db select
      const whereMock = vi.fn().mockResolvedValue([mockSessionStudent]);
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock });

      // Mock channel empty
      const mockChannel = {
        id: 'ephemeral-channel-123',
        name: 'Session-User',
        members: { size: 0 },
        delete: vi.fn().mockResolvedValue(undefined),
      };
      mockOldState.channel = mockChannel;

      // Mock db update
      const whereUpdateMock = vi.fn().mockResolvedValue([]);
      const setMock = vi.fn().mockReturnValue({ where: whereUpdateMock });
      (db.update as any).mockReturnValue({ set: setMock });

      await voiceStateUpdate.voiceStateUpdate([mockOldState, mockNewState]);

      expect(mockChannel.delete).toHaveBeenCalled();
      expect(db.update).toHaveBeenCalledWith(sessionStudents);
    });

    it('should not delete non-empty ephemeral channel', async () => {
      mockOldState.channelId = 'ephemeral-channel-123';
      mockNewState.channelId = null;

      mockQueueManager.getQueueByWaitingRoom.mockResolvedValue(null);

      const mockSessionStudent = { id: 'session-student-123' };
      // Mock db select
      const whereMock = vi.fn().mockResolvedValue([mockSessionStudent]);
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock });

      // Mock channel not empty
      const mockChannel = {
        id: 'ephemeral-channel-123',
        name: 'Session-User',
        members: { size: 1 },
        delete: vi.fn(),
      };
      mockOldState.channel = mockChannel;

      await voiceStateUpdate.voiceStateUpdate([mockOldState, mockNewState]);

      expect(mockChannel.delete).not.toHaveBeenCalled();
    });
  });
});
