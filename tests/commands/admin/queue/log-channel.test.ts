import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminQueueLogChannel } from '@commands/admin/queue/log-channel';
import { QueueManager } from '@managers/QueueManager';
import { CommandInteraction, MessageFlags, Colors, TextChannel } from 'discord.js';
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

describe('AdminQueueLogChannel', () => {
  let adminQueueLogChannel: AdminQueueLogChannel;
  let mockQueueManager: any;
  let mockInteraction: any;
  let mockChannel: any;

  beforeEach(() => {
    mockQueueManager = mockDeep<QueueManager>();
    (QueueManager as any).mockImplementation(function () { return mockQueueManager });

    adminQueueLogChannel = new AdminQueueLogChannel();
    // Manually inject the mock
    (adminQueueLogChannel as any).queueManager = mockQueueManager;

    mockInteraction = mockDeep<CommandInteraction>();
    mockInteraction.user = { tag: 'testuser', id: 'user-123' };
    mockInteraction.guild = { id: 'guild-123', name: 'Test Guild' };
    mockInteraction.reply = vi.fn();

    mockChannel = mockDeep<TextChannel>();
    mockChannel.id = 'channel-123';
    mockChannel.name = 'Log Channel';
  });

  it('should set log channel successfully', async () => {
    const queueName = 'test-queue';

    mockQueueManager.setLogChannel.mockResolvedValue(undefined);

    await adminQueueLogChannel.setLogChannel(queueName, mockChannel, mockInteraction);

    expect(mockQueueManager.setLogChannel).toHaveBeenCalledWith('guild-123', queueName, 'channel-123');
    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Log Channel Set',
            description: `Log channel for queue **${queueName}** set to <#${mockChannel.id}>.`,
            color: Colors.Green,
          }),
        }),
      ]),
      flags: MessageFlags.Ephemeral,
    }));
  });

  it('should handle queue not found error', async () => {
    const queueName = 'non-existent-queue';

    mockQueueManager.setLogChannel.mockRejectedValue(new QueueNotFoundError(queueName));

    await adminQueueLogChannel.setLogChannel(queueName, mockChannel, mockInteraction);

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

    mockQueueManager.setLogChannel.mockRejectedValue(new Error('Database error'));

    await adminQueueLogChannel.setLogChannel(queueName, mockChannel, mockInteraction);

    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Error',
            description: 'Failed to set log channel.',
          }),
        }),
      ]),
      flags: MessageFlags.Ephemeral,
    }));
  });

  it('should not allow command outside of guild', async () => {
    mockInteraction.guild = null;

    await adminQueueLogChannel.setLogChannel('name', mockChannel, mockInteraction);

    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: 'This command can only be used in a server.',
      flags: MessageFlags.Ephemeral,
    });
  });
});
