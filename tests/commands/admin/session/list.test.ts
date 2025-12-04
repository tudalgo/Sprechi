import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminSessionListCommand } from '@commands/admin/session/list';
import { QueueManager } from '@managers/QueueManager';
import { CommandInteraction } from 'discord.js';
import { mockDeep } from 'vitest-mock-extended';
import { Guild } from 'discord.js';

describe('AdminSessionListCommand', () => {
  let mockQueueManager: any;
  let mockInteraction: any;

  beforeEach(() => {
    mockQueueManager = mockDeep<QueueManager>();
    mockInteraction = mockDeep<CommandInteraction>();
    mockInteraction.guildId = 'guild-123';
    mockInteraction.guild = mockDeep<Guild>();
    mockInteraction.editReply = vi.fn();
    mockInteraction.deferReply = vi.fn();
  });

  it('should list active sessions', async () => {
    const command = new AdminSessionListCommand(mockQueueManager);
    mockQueueManager.getAllActiveSessions.mockResolvedValue([
      {
        id: 'session-123',
        tutorId: 'tutor-123',
        startTime: new Date(),
        queueName: 'queue-1',
        studentCount: 2,
      },
    ]);
    mockInteraction.guild.members.fetch.mockResolvedValue({ user: { displayName: 'Mock Tutor' } });



    await command.list(mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: 'Active Sessions',
            }),
          }),
        ]),
      })
    );
  });

  it('should show message if no active sessions', async () => {
    const command = new AdminSessionListCommand(mockQueueManager);
    mockQueueManager.getAllActiveSessions.mockResolvedValue([]);

    await command.list(mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              description: 'There are no active sessions on this server.',
            }),
          }),
        ]),
      })
    );
  });

  it('should return early if not in a guild', async () => {
    const command = new AdminSessionListCommand(mockQueueManager);
    mockInteraction.guildId = null;

    await command.list(mockInteraction);

    expect(mockInteraction.deferReply).not.toHaveBeenCalled();
  });
});
