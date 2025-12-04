import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminQueueUnlockCommand } from '@commands/admin/queue/unlock';
import { QueueManager } from '@managers/QueueManager';
import { CommandInteraction } from 'discord.js';
import { mockDeep } from 'vitest-mock-extended';

describe('AdminQueueUnlockCommand', () => {
  let mockQueueManager: any;
  let mockInteraction: any;

  beforeEach(() => {
    mockQueueManager = mockDeep<QueueManager>();
    mockInteraction = mockDeep<CommandInteraction>();
    mockInteraction.guildId = 'guild-123';
    mockInteraction.editReply = vi.fn();
    mockInteraction.deferReply = vi.fn();
  });

  it('should unlock queue successfully', async () => {
    const command = new AdminQueueUnlockCommand(mockQueueManager);
    mockQueueManager.setQueueLockState.mockResolvedValue(undefined);

    await command.unlock('test-queue', mockInteraction);

    expect(mockQueueManager.setQueueLockState).toHaveBeenCalledWith('guild-123', 'test-queue', false);
    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: 'Queue Unlocked',
            }),
          }),
        ]),
      })
    );
  });

  it("should throw an error if the queue is not locked", async () => {
    const command = new AdminQueueUnlockCommand(mockQueueManager);
    mockQueueManager.setQueueLockState.mockRejectedValue(new Error('Queue is not locked'));

    await command.unlock('test-queue', mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: 'Error',
              description: 'Queue is not locked',
            }),
          }),
        ]),
      })
    );
  });

  it('should throw an error if the queue is not found', async () => {
    const command = new AdminQueueUnlockCommand(mockQueueManager);
    mockQueueManager.setQueueLockState.mockRejectedValue(new Error('Queue not found'));

    await command.unlock('test-queue', mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: 'Error',
              description: 'Queue not found',
            }),
          }),
        ]),
      })
    );
  });

  it('should return early if not in a guild', async () => {
    const command = new AdminQueueUnlockCommand(mockQueueManager);
    mockInteraction.guildId = null;

    await command.unlock('test-queue', mockInteraction);

    expect(mockInteraction.deferReply).not.toHaveBeenCalled();
  });
});
