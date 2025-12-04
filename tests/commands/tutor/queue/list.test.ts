import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TutorQueueList } from '@commands/tutor/queue/list';
import { QueueManager } from '@managers/QueueManager';
import { CommandInteraction, MessageFlags, Colors } from 'discord.js';
import { mockDeep } from 'vitest-mock-extended';
import { QueueError } from '@errors/QueueErrors';

// Mock QueueManager
vi.mock('@managers/QueueManager');

// Mock logger
vi.mock('@utils/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('TutorQueueList', () => {
  let tutorQueueList: TutorQueueList;
  let mockQueueManager: any;
  let mockInteraction: any;

  beforeEach(() => {
    mockQueueManager = mockDeep<QueueManager>();
    (QueueManager as any).mockImplementation(function () { return mockQueueManager });

    tutorQueueList = new TutorQueueList(mockQueueManager);
    // Manually inject the mock
    (tutorQueueList as any).queueManager = mockQueueManager;

    mockInteraction = mockDeep<CommandInteraction>();
    mockInteraction.user = { tag: 'tutor', id: 'tutor-123' };
    mockInteraction.guild = { id: 'guild-123', name: 'Test Guild' };
    mockInteraction.reply = vi.fn();
  });

  it('should list queue members successfully', async () => {
    const mockSession = { queue: { name: 'test-queue' } };
    const mockMembers = [
      { userId: 'student-1' },
      { userId: 'student-2' },
    ];

    mockQueueManager.getActiveSession.mockResolvedValue(mockSession);
    mockQueueManager.getQueueMembers.mockResolvedValue(mockMembers);

    await tutorQueueList.list(undefined, mockInteraction);

    expect(mockQueueManager.getActiveSession).toHaveBeenCalledWith('guild-123', 'tutor-123');
    expect(mockQueueManager.getQueueMembers).toHaveBeenCalledWith('guild-123', 'test-queue', 5);
    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Queue: test-queue',
            description: expect.stringContaining('1. <@student-1>\n2. <@student-2>'),
            color: Colors.Blue,
          }),
        }),
      ]),
      flags: MessageFlags.Ephemeral,
    }));
  });

  it('should handle empty queue', async () => {
    const mockSession = { queue: { name: 'test-queue' } };

    mockQueueManager.getActiveSession.mockResolvedValue(mockSession);
    mockQueueManager.getQueueMembers.mockResolvedValue([]);

    await tutorQueueList.list(undefined, mockInteraction);

    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Queue: test-queue',
            description: 'The queue is empty.',
          }),
        }),
      ]),
      flags: MessageFlags.Ephemeral,
    }));
  });

  it('should handle no active session', async () => {
    mockQueueManager.getActiveSession.mockResolvedValue(null);

    await tutorQueueList.list(undefined, mockInteraction);

    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Error',
            description: 'You do not have an active session.',
          }),
        }),
      ]),
      flags: MessageFlags.Ephemeral,
    }));
  });

  it('should respect max_entries parameter', async () => {
    const mockSession = { queue: { name: 'test-queue' } };

    mockQueueManager.getActiveSession.mockResolvedValue(mockSession);
    mockQueueManager.getQueueMembers.mockResolvedValue([]);

    await tutorQueueList.list(10, mockInteraction);

    expect(mockQueueManager.getQueueMembers).toHaveBeenCalledWith('guild-123', 'test-queue', 10);
  });
});
