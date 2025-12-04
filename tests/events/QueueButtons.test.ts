import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueueButtons } from '@events/QueueButtons';
import { QueueManager } from '@managers/QueueManager';
import { ButtonInteraction, MessageFlags, Colors } from 'discord.js';
import { mockDeep } from 'vitest-mock-extended';
import { NotInQueueError } from '@errors/QueueErrors';

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

describe('QueueButtons', () => {
  let queueButtons: QueueButtons;
  let mockQueueManager: any;
  let mockInteraction: any;

  beforeEach(() => {
    mockQueueManager = mockDeep<QueueManager>();
    (QueueManager as any).mockImplementation(function () { return mockQueueManager });

    queueButtons = new QueueButtons(mockQueueManager);

    mockInteraction = mockDeep<ButtonInteraction>();
    mockInteraction.user = { tag: 'user', id: 'user-123' };
    mockInteraction.customId = 'queue_refresh_queue-123';
    mockInteraction.deferUpdate = vi.fn();
    mockInteraction.editReply = vi.fn();
    mockInteraction.followUp = vi.fn();
  });

  describe('refresh', () => {
    it('should refresh status successfully', async () => {
      const mockQueue = { id: 'queue-123', name: 'test-queue' };
      const mockMember = { joinedAt: new Date() };

      mockQueueManager.getQueueById.mockResolvedValue(mockQueue);
      mockQueueManager.getQueueMember.mockResolvedValue(mockMember);
      mockQueueManager.getQueuePosition.mockResolvedValue(1);

      await queueButtons.refresh(mockInteraction);

      expect(mockQueueManager.getQueueById).toHaveBeenCalledWith('queue-123');
      expect(mockQueueManager.getQueueMember).toHaveBeenCalledWith('queue-123', 'user-123');
      expect(mockInteraction.editReply).toHaveBeenCalledWith(expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: 'Joined Queue: test-queue',
              description: expect.stringContaining(`<t:${Math.floor(mockMember.joinedAt.getTime() / 1000)}:R>`),
              color: Colors.Green,
            }),
          }),
        ]),
      }));
    });

    it('should handle queue not found', async () => {
      mockQueueManager.getQueueById.mockResolvedValue(null);

      await queueButtons.refresh(mockInteraction);

      expect(mockInteraction.followUp).toHaveBeenCalledWith({
        content: 'Queue not found.',
        flags: MessageFlags.Ephemeral,
      });
    });

    it('should handle user not in queue', async () => {
      const mockQueue = { id: 'queue-123', name: 'test-queue' };
      mockQueueManager.getQueueById.mockResolvedValue(mockQueue);
      mockQueueManager.getQueueMember.mockResolvedValue(null);

      await queueButtons.refresh(mockInteraction);

      expect(mockInteraction.followUp).toHaveBeenCalledWith({
        content: 'You are not in this queue anymore.',
        flags: MessageFlags.Ephemeral,
      });
    });
  });

  describe('leave', () => {
    beforeEach(() => {
      mockInteraction.customId = 'queue_leave_queue-123';
    });

    it('should leave queue successfully', async () => {
      const mockQueue = { id: 'queue-123', name: 'test-queue', guildId: 'guild-123' };
      mockQueueManager.getQueueById.mockResolvedValue(mockQueue);
      mockQueueManager.leaveQueue.mockResolvedValue(undefined);

      await queueButtons.leave(mockInteraction);

      expect(mockQueueManager.leaveQueue).toHaveBeenCalledWith('guild-123', 'test-queue', 'user-123');
      expect(mockInteraction.editReply).toHaveBeenCalledWith(expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: 'Left Queue',
              color: Colors.Yellow,
            }),
          }),
        ]),
      }));
    });

    it('should handle not in queue error', async () => {
      const mockQueue = { id: 'queue-123', name: 'test-queue', guildId: 'guild-123' };
      mockQueueManager.getQueueById.mockResolvedValue(mockQueue);
      mockQueueManager.leaveQueue.mockRejectedValue(new NotInQueueError('test-queue'));

      await queueButtons.leave(mockInteraction);

      expect(mockInteraction.followUp).toHaveBeenCalledWith({
        content: 'You are not in the queue.',
        flags: MessageFlags.Ephemeral,
      });
    });
  });

  describe('rejoin', () => {
    beforeEach(() => {
      mockInteraction.customId = 'queue_rejoin_queue-123';
    });

    it('should rejoin queue successfully', async () => {
      const mockQueue = { id: 'queue-123', name: 'test-queue', guildId: 'guild-123' };
      mockQueueManager.getQueueById.mockResolvedValue(mockQueue);
      mockQueueManager.joinQueue.mockResolvedValue(undefined);

      await queueButtons.rejoin(mockInteraction);

      expect(mockQueueManager.joinQueue).toHaveBeenCalledWith('guild-123', 'test-queue', 'user-123');
      expect(mockInteraction.editReply).toHaveBeenCalledWith(expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: 'Rejoined Queue',
              color: Colors.Green,
            }),
          }),
        ]),
      }));
    });

    it('should handle errors during rejoin', async () => {
      const mockQueue = { id: 'queue-123', name: 'test-queue', guildId: 'guild-123' };
      mockQueueManager.getQueueById.mockResolvedValue(mockQueue);
      mockQueueManager.joinQueue.mockRejectedValue(new Error('Failed to join'));

      await queueButtons.rejoin(mockInteraction);

      expect(mockInteraction.followUp).toHaveBeenCalledWith({
        content: 'Failed to join',
        flags: MessageFlags.Ephemeral,
      });
    });
  });
});
