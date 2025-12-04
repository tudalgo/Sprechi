import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TutorSessionInfo } from '@commands/tutor/session/info';
import { QueueManager } from '@managers/QueueManager';
import { CommandInteraction, MessageFlags, Colors } from 'discord.js';
import { mockDeep } from 'vitest-mock-extended';

// Mock QueueManager
vi.mock('@managers/QueueManager');

// Mock db
vi.mock('@db', () => ({
  default: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn(),
  },
}));
import db from '@db';

// Mock logger
vi.mock('@utils/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('TutorSessionInfo', () => {
  let tutorSessionInfo: TutorSessionInfo;
  let mockQueueManager: any;
  let mockInteraction: any;

  beforeEach(() => {
    mockQueueManager = mockDeep<QueueManager>();
    (QueueManager as any).mockImplementation(function () { return mockQueueManager });

    tutorSessionInfo = new TutorSessionInfo(mockQueueManager);
    // Manually inject the mock
    (tutorSessionInfo as any).queueManager = mockQueueManager;

    mockInteraction = mockDeep<CommandInteraction>();
    mockInteraction.user = { tag: 'tutor', id: 'tutor-123' };
    mockInteraction.guild = { id: 'guild-123', name: 'Test Guild' };
    mockInteraction.reply = vi.fn();
  });

  it('should show session info successfully', async () => {
    const startTime = new Date();
    const mockSession = {
      queue: { name: 'test-queue' },
      session: { id: 'session-123', startTime: startTime.toISOString() }
    };

    mockQueueManager.getActiveSession.mockResolvedValue(mockSession);
    ((db as any).where as any).mockResolvedValue([{ count: 5 }]);

    await tutorSessionInfo.info(mockInteraction);

    expect(mockQueueManager.getActiveSession).toHaveBeenCalledWith('guild-123', 'tutor-123');
    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Session Info',
            fields: expect.arrayContaining([
              expect.objectContaining({ name: 'Queue', value: 'test-queue' }),
              expect.objectContaining({ name: 'Students Helped', value: '5' }),
            ]),
            color: Colors.Blue,
          }),
        }),
      ]),
      flags: MessageFlags.Ephemeral,
    }));
  });

  it('should handle no active session', async () => {
    mockQueueManager.getActiveSession.mockResolvedValue(null);

    await tutorSessionInfo.info(mockInteraction);

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

  it('should not allow command outside of guild', async () => {
    mockInteraction.guild = null;

    await tutorSessionInfo.info(mockInteraction);

    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: 'This command can only be used in a server.',
      flags: MessageFlags.Ephemeral,
    });
  });
});
