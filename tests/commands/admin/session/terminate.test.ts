import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminSessionTerminateCommand } from '@commands/admin/session/terminate';
import { QueueManager } from '@managers/QueueManager';
import { CommandInteraction, User } from 'discord.js';
import { mockDeep } from 'vitest-mock-extended';

describe('AdminSessionTerminateCommand', () => {
  let mockQueueManager: any;
  let mockInteraction: any;

  beforeEach(() => {
    mockQueueManager = mockDeep<QueueManager>();
    mockInteraction = mockDeep<CommandInteraction>();
    mockInteraction.guildId = 'guild-123';
    mockInteraction.editReply = vi.fn();
    mockInteraction.deferReply = vi.fn();
  });

  it('should terminate sessions for user', async () => {
    const command = new AdminSessionTerminateCommand(mockQueueManager);
    const mockUser = mockDeep<User>();
    mockUser.id = 'user-123';
    mockQueueManager.terminateSessionsByUser.mockResolvedValue(1);

    await command.terminate(mockUser, mockInteraction);

    expect(mockQueueManager.terminateSessionsByUser).toHaveBeenCalledWith('guild-123', 'user-123');
    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              description: expect.stringContaining('Successfully terminated'),
            }),
          }),
        ]),
      })
    );
  });

  it('should show error if no sessions found', async () => {
    const command = new AdminSessionTerminateCommand(mockQueueManager);
    const mockUser = mockDeep<User>();
    mockUser.id = 'user-123';
    mockQueueManager.terminateSessionsByUser.mockResolvedValue(0);

    await command.terminate(mockUser, mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              description: expect.stringContaining('No active sessions found'),
            }),
          }),
        ]),
      })
    );
  });

  it('should return early if not in a guild', async () => {
    const command = new AdminSessionTerminateCommand(mockQueueManager);
    const mockUser = mockDeep<User>();
    mockInteraction.guildId = null;

    await command.terminate(mockUser, mockInteraction);

    expect(mockInteraction.deferReply).not.toHaveBeenCalled();
  });
});
