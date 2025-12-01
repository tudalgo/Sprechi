import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TutorQueueNext } from '@commands/tutor/queue/next';
import { QueueManager } from '@managers/QueueManager';
import { RoomManager } from '@managers/RoomManager';
import { CommandInteraction, MessageFlags, Colors } from 'discord.js';
import { mockDeep } from 'vitest-mock-extended';
import { QueueError } from '@errors/QueueErrors';

// Mock Managers
vi.mock('@managers/QueueManager');
vi.mock('@managers/RoomManager');

// Mock logger
vi.mock('@utils/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('TutorQueueNext', () => {
  let tutorQueueNext: TutorQueueNext;
  let mockQueueManager: any;
  let mockRoomManager: any;
  let mockInteraction: any;

  beforeEach(() => {
    mockQueueManager = mockDeep<QueueManager>();
    (QueueManager as any).mockImplementation(function () { return mockQueueManager });

    mockRoomManager = mockDeep<RoomManager>();
    (RoomManager as any).mockImplementation(function () { return mockRoomManager });

    tutorQueueNext = new TutorQueueNext();
    // Manually inject the mocks
    (tutorQueueNext as any).queueManager = mockQueueManager;
    (tutorQueueNext as any).roomManager = mockRoomManager;

    mockInteraction = mockDeep<CommandInteraction>();
    mockInteraction.user = { tag: 'tutor', id: 'tutor-123' };
    mockInteraction.guild = { id: 'guild-123', name: 'Test Guild' };
    mockInteraction.deferReply = vi.fn();
    mockInteraction.editReply = vi.fn();
  });

  it('should pick next student successfully', async () => {
    const mockSession = { queue: { name: 'test-queue' }, session: { id: 'session-123' } };
    const mockMembers = [{ userId: 'student-1' }];

    mockQueueManager.getActiveSession.mockResolvedValue(mockSession);
    mockQueueManager.getQueueMembers.mockResolvedValue(mockMembers);
    mockQueueManager.processStudentPick.mockResolvedValue(undefined);

    await tutorQueueNext.next(mockInteraction);

    expect(mockInteraction.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
    expect(mockQueueManager.getActiveSession).toHaveBeenCalledWith('guild-123', 'tutor-123');
    expect(mockQueueManager.getQueueMembers).toHaveBeenCalledWith('guild-123', 'test-queue');
    expect(mockQueueManager.processStudentPick).toHaveBeenCalledWith(
      mockInteraction,
      mockRoomManager,
      mockSession.queue,
      mockSession.session,
      'student-1',
      'tutor-123'
    );
  });

  it('should handle empty queue', async () => {
    const mockSession = { queue: { name: 'test-queue' } };

    mockQueueManager.getActiveSession.mockResolvedValue(mockSession);
    mockQueueManager.getQueueMembers.mockResolvedValue([]);

    await tutorQueueNext.next(mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Queue: test-queue',
            description: 'The queue is empty.',
          }),
        }),
      ]),
    }));
  });

  it('should handle no active session', async () => {
    mockQueueManager.getActiveSession.mockResolvedValue(null);

    await tutorQueueNext.next(mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Error',
            description: 'You do not have an active session.',
          }),
        }),
      ]),
    }));
  });

  it('should handle errors during processing', async () => {
    const mockSession = { queue: { name: 'test-queue' } };
    const mockMembers = [{ userId: 'student-1' }];

    mockQueueManager.getActiveSession.mockResolvedValue(mockSession);
    mockQueueManager.getQueueMembers.mockResolvedValue(mockMembers);
    mockQueueManager.processStudentPick.mockRejectedValue(new Error('Processing failed'));

    await tutorQueueNext.next(mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Error',
            description: 'Processing failed',
          }),
        }),
      ]),
    }));
  });
});
