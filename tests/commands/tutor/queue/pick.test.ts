import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TutorQueuePick } from '@commands/tutor/queue/pick';
import { QueueManager } from '@managers/QueueManager';
import { RoomManager } from '@managers/RoomManager';
import { CommandInteraction, MessageFlags, Colors, User } from 'discord.js';
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

describe('TutorQueuePick', () => {
  let tutorQueuePick: TutorQueuePick;
  let mockQueueManager: any;
  let mockRoomManager: any;
  let mockInteraction: any;
  let mockUser: any;

  beforeEach(() => {
    mockQueueManager = mockDeep<QueueManager>();
    (QueueManager as any).mockImplementation(function () { return mockQueueManager });

    mockRoomManager = mockDeep<RoomManager>();
    (RoomManager as any).mockImplementation(function () { return mockRoomManager });

    tutorQueuePick = new TutorQueuePick();
    // Manually inject the mocks
    (tutorQueuePick as any).queueManager = mockQueueManager;
    (tutorQueuePick as any).roomManager = mockRoomManager;

    mockInteraction = mockDeep<CommandInteraction>();
    mockInteraction.user = { tag: 'tutor', id: 'tutor-123' };
    mockInteraction.guild = { id: 'guild-123', name: 'Test Guild' };
    mockInteraction.deferReply = vi.fn();
    mockInteraction.editReply = vi.fn();

    mockUser = mockDeep<User>();
    mockUser.id = 'student-1';
  });

  it('should pick a specific student successfully', async () => {
    const mockSession = { queue: { id: 'queue-1', name: 'test-queue' }, session: { id: 'session-123' } };
    const mockMember = { userId: 'student-1' };

    mockQueueManager.getActiveSession.mockResolvedValue(mockSession);
    mockQueueManager.getQueueMember.mockResolvedValue(mockMember);
    mockQueueManager.processStudentPick.mockResolvedValue(undefined);

    await tutorQueuePick.pick(mockUser, mockInteraction);

    expect(mockInteraction.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
    expect(mockQueueManager.getActiveSession).toHaveBeenCalledWith('guild-123', 'tutor-123');
    expect(mockQueueManager.getQueueMember).toHaveBeenCalledWith('queue-1', 'student-1');
    expect(mockQueueManager.processStudentPick).toHaveBeenCalledWith(
      mockInteraction,
      mockRoomManager,
      mockSession.queue,
      mockSession.session,
      'student-1',
      'tutor-123'
    );
  });

  it('should handle student not in queue', async () => {
    const mockSession = { queue: { id: 'queue-1', name: 'test-queue' } };

    mockQueueManager.getActiveSession.mockResolvedValue(mockSession);
    mockQueueManager.getQueueMember.mockResolvedValue(null);

    await tutorQueuePick.pick(mockUser, mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Error',
            description: expect.stringContaining('is not in the queue'),
          }),
        }),
      ]),
    }));
  });

  it('should handle no active session', async () => {
    mockQueueManager.getActiveSession.mockResolvedValue(null);

    await tutorQueuePick.pick(mockUser, mockInteraction);

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
    const mockSession = { queue: { id: 'queue-1', name: 'test-queue' } };
    const mockMember = { userId: 'student-1' };

    mockQueueManager.getActiveSession.mockResolvedValue(mockSession);
    mockQueueManager.getQueueMember.mockResolvedValue(mockMember);
    mockQueueManager.processStudentPick.mockRejectedValue(new Error('Processing failed'));

    await tutorQueuePick.pick(mockUser, mockInteraction);

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
