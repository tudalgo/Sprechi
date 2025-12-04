import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TutorSessionStart } from '@commands/tutor/session/start';
import { QueueManager } from '@managers/QueueManager';
import { CommandInteraction, MessageFlags, Colors } from 'discord.js';
import { mockDeep } from 'vitest-mock-extended';
import { QueueNotFoundError, SessionAlreadyActiveError, StudentCannotStartSessionError } from '@errors/QueueErrors';

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

describe('TutorSessionStart', () => {
  let tutorSessionStart: TutorSessionStart;
  let mockQueueManager: any;
  let mockInteraction: any;

  beforeEach(() => {
    mockQueueManager = mockDeep<QueueManager>();
    (QueueManager as any).mockImplementation(function () { return mockQueueManager });

    tutorSessionStart = new TutorSessionStart(mockQueueManager);
    // Manually inject the mock
    (tutorSessionStart as any).queueManager = mockQueueManager;

    mockInteraction = mockDeep<CommandInteraction>();
    mockInteraction.user = { tag: 'tutor', id: 'tutor-123' };
    mockInteraction.guild = { id: 'guild-123', name: 'Test Guild' };
    mockInteraction.reply = vi.fn();
  });

  it('should start a session successfully when queue name is provided', async () => {
    const queueName = 'test-queue';
    const mockQueue = { name: queueName };

    mockQueueManager.resolveQueue.mockResolvedValue(mockQueue);
    mockQueueManager.createSession.mockResolvedValue(undefined);

    await tutorSessionStart.start(queueName, mockInteraction);

    expect(mockQueueManager.resolveQueue).toHaveBeenCalledWith('guild-123', queueName);
    expect(mockQueueManager.createSession).toHaveBeenCalledWith('guild-123', queueName, 'tutor-123');
    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Session Started',
            description: `You have started a session on queue **${queueName}**.`,
            color: Colors.Green,
          }),
        }),
      ]),
      flags: MessageFlags.Ephemeral,
    }));
  });

  it('should start a session successfully when queue name is auto-detected', async () => {
    const queueName = 'auto-queue';
    const mockQueue = { name: queueName };

    mockQueueManager.resolveQueue.mockResolvedValue(mockQueue);
    mockQueueManager.createSession.mockResolvedValue(undefined);

    await tutorSessionStart.start(undefined, mockInteraction);

    expect(mockQueueManager.resolveQueue).toHaveBeenCalledWith('guild-123', undefined);
    expect(mockQueueManager.createSession).toHaveBeenCalledWith('guild-123', queueName, 'tutor-123');
    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Session Started',
            description: `You have started a session on queue **${queueName}**.`,
          }),
        }),
      ]),
      flags: MessageFlags.Ephemeral,
    }));
  });

  it('should handle queue not found error', async () => {
    const queueName = 'non-existent-queue';

    mockQueueManager.resolveQueue.mockRejectedValue(new QueueNotFoundError(queueName));

    await tutorSessionStart.start(queueName, mockInteraction);

    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Error',
            description: `Queue **${queueName}** not found.`,
          }),
        }),
      ]),
      flags: MessageFlags.Ephemeral,
    }));
  });

  it('should handle session already active error', async () => {
    const queueName = 'test-queue';

    mockQueueManager.resolveQueue.mockResolvedValue({ name: queueName });
    mockQueueManager.createSession.mockRejectedValue(new SessionAlreadyActiveError());

    await tutorSessionStart.start(queueName, mockInteraction);

    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Error',
            description: 'You already have an active session.',
          }),
        }),
      ]),
      flags: MessageFlags.Ephemeral,
    }));
  });

  it('should handle student in queue trying to start session', async () => {
    const queueName = 'test-queue';

    mockQueueManager.resolveQueue.mockResolvedValue({ name: queueName });
    mockQueueManager.createSession.mockRejectedValue(new StudentCannotStartSessionError());

    await tutorSessionStart.start(queueName, mockInteraction);

    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Error',
            description: 'You cannot start a session while you are in a queue.',
          }),
        }),
      ]),
      flags: MessageFlags.Ephemeral,
    }));
  });

  it('should not allow command outside of guild', async () => {
    mockInteraction.guild = null;

    await tutorSessionStart.start('name', mockInteraction);

    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: 'This command can only be used in a server.',
      flags: MessageFlags.Ephemeral,
    });
  });
});
