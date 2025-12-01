import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminQueueLock } from '@commands/admin/queue/lock';
import { QueueManager } from '@managers/QueueManager';
import { CommandInteraction, MessageFlags, Colors } from 'discord.js';
import { mockDeep } from 'vitest-mock-extended';
import { QueueNotFoundError } from '@errors/QueueErrors';

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

describe('AdminQueueLock', () => {
  let adminQueueLock: AdminQueueLock;
  let mockQueueManager: any;
  let mockInteraction: any;

  beforeEach(() => {
    mockQueueManager = mockDeep<QueueManager>();
    (QueueManager as any).mockImplementation(function () { return mockQueueManager });

    adminQueueLock = new AdminQueueLock();
    // Manually inject the mock
    (adminQueueLock as any).queueManager = mockQueueManager;

    mockInteraction = mockDeep<CommandInteraction>();
    mockInteraction.user = { tag: 'testuser', id: 'user-123' };
    mockInteraction.guild = { id: 'guild-123', name: 'Test Guild' };
    mockInteraction.reply = vi.fn();
  });

  it('should lock a queue successfully', async () => {
    const queueName = 'test-queue';

    mockQueueManager.toggleLock.mockResolvedValue(undefined);

    await adminQueueLock.lock(queueName, true, mockInteraction);

    expect(mockQueueManager.toggleLock).toHaveBeenCalledWith('guild-123', queueName, true);
    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Queue Locked',
            description: `Queue **${queueName}** has been locked.`,
            color: Colors.Red,
          }),
        }),
      ]),
      flags: MessageFlags.Ephemeral,
    }));
  });

  it('should unlock a queue successfully', async () => {
    const queueName = 'test-queue';

    mockQueueManager.toggleLock.mockResolvedValue(undefined);

    await adminQueueLock.lock(queueName, false, mockInteraction);

    expect(mockQueueManager.toggleLock).toHaveBeenCalledWith('guild-123', queueName, false);
    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Queue Unlocked',
            description: `Queue **${queueName}** has been unlocked.`,
            color: Colors.Green,
          }),
        }),
      ]),
      flags: MessageFlags.Ephemeral,
    }));
  });

  it('should handle queue not found error', async () => {
    const queueName = 'non-existent-queue';

    mockQueueManager.toggleLock.mockRejectedValue(new QueueNotFoundError(queueName));

    await adminQueueLock.lock(queueName, true, mockInteraction);

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

  it('should handle generic errors', async () => {
    const queueName = 'error-queue';

    mockQueueManager.toggleLock.mockRejectedValue(new Error('Database error'));

    await adminQueueLock.lock(queueName, true, mockInteraction);

    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Error',
            description: 'Failed to update queue lock state.',
          }),
        }),
      ]),
      flags: MessageFlags.Ephemeral,
    }));
  });

  it('should not allow command outside of guild', async () => {
    mockInteraction.guild = null;

    await adminQueueLock.lock('name', true, mockInteraction);

    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: 'This command can only be used in a server.',
      flags: MessageFlags.Ephemeral,
    });
  });
});
