import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminQueueCreate } from '@commands/admin/queue/create';
import { QueueManager } from '@managers/QueueManager';
import { CommandInteraction, MessageFlags } from 'discord.js';
import { mockDeep, mockReset } from 'vitest-mock-extended';

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

describe('AdminQueueCreate', () => {
  let adminQueueCreate: AdminQueueCreate;
  let mockQueueManager: any;
  let mockInteraction: any;

  beforeEach(() => {
    mockQueueManager = mockDeep<QueueManager>();
    (QueueManager as any).mockImplementation(function () { return mockQueueManager });

    adminQueueCreate = new AdminQueueCreate();
    // Manually inject the mock because the class instantiates it internally
    (adminQueueCreate as any).queueManager = mockQueueManager;

    mockInteraction = mockDeep<CommandInteraction>();
    mockInteraction.user = { tag: 'testuser', id: 'user-123' };
    mockInteraction.guild = { id: 'guild-123', name: 'Test Guild' };
    mockInteraction.reply = vi.fn();
  });

  it('should create a queue successfully', async () => {
    const queueName = 'new-queue';
    const description = 'A new queue';

    mockQueueManager.getQueueByName.mockResolvedValue(null);
    mockQueueManager.createQueue.mockResolvedValue({
      name: queueName,
      description: description,
    });

    await adminQueueCreate.create(queueName, description, mockInteraction);

    expect(mockQueueManager.getQueueByName).toHaveBeenCalledWith('guild-123', queueName);
    expect(mockQueueManager.createQueue).toHaveBeenCalledWith({
      guildId: 'guild-123',
      name: queueName,
      description: description,
    });
    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: ':white_check_mark: Queue Created',
            description: `**${queueName}**\n${description}`,
          }),
        }),
      ]),
      flags: MessageFlags.Ephemeral,
    }));
  });

  it('should fail if queue already exists', async () => {
    const queueName = 'existing-queue';
    const description = 'An existing queue';

    mockQueueManager.getQueueByName.mockResolvedValue({ id: 'queue-123' });

    await adminQueueCreate.create(queueName, description, mockInteraction);

    expect(mockQueueManager.getQueueByName).toHaveBeenCalledWith('guild-123', queueName);
    expect(mockQueueManager.createQueue).not.toHaveBeenCalled();
    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: ':x: Queue Already Exists',
          }),
        }),
      ]),
      flags: MessageFlags.Ephemeral,
    }));
  });

  it('should handle errors during creation', async () => {
    const queueName = 'error-queue';
    const description = 'An error queue';

    mockQueueManager.getQueueByName.mockResolvedValue(null);
    mockQueueManager.createQueue.mockRejectedValue(new Error('Database error'));

    await adminQueueCreate.create(queueName, description, mockInteraction);

    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: ':x: Queue Creation Failed',
          }),
        }),
      ]),
      flags: MessageFlags.Ephemeral,
    }));
  });

  it('should not allow command outside of guild', async () => {
    mockInteraction.guild = null;

    await adminQueueCreate.create('name', 'desc', mockInteraction);

    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: 'This command can only be used in a server.',
      flags: MessageFlags.Ephemeral,
    });
  });
});
