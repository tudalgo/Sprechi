import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueueManager } from '@managers/QueueManager';
import db from '@db';
import { queues } from '@db/schema';
import { mockDeep, mockReset } from 'vitest-mock-extended';

// Mock the db module
vi.mock('@db', () => ({
  default: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock logger to avoid cluttering test output
vi.mock('@utils/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('QueueManager', () => {
  let queueManager: QueueManager;

  beforeEach(() => {
    queueManager = new QueueManager();
    vi.clearAllMocks();
  });

  describe('createQueue', () => {
    it('should create a queue successfully', async () => {
      const mockQueueData = {
        guildId: 'guild-123',
        name: 'test-queue',
        description: 'A test queue',
      };

      const mockCreatedQueue = {
        id: 'queue-123',
        ...mockQueueData,
        isLocked: false,
        waitingRoomId: null,
        logChannelId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock db.insert chain
      const returningMock = vi.fn().mockResolvedValue([mockCreatedQueue]);
      const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
      (db.insert as any).mockReturnValue({ values: valuesMock });

      const result = await queueManager.createQueue(mockQueueData);

      expect(db.insert).toHaveBeenCalledWith(queues);
      expect(valuesMock).toHaveBeenCalledWith({
        guildId: mockQueueData.guildId,
        name: mockQueueData.name,
        description: mockQueueData.description,
        isLocked: false,
      });
      expect(result).toEqual(mockCreatedQueue);
    });
  });

  describe('getQueueByName', () => {
    it('should return a queue if it exists', async () => {
      const mockQueue = {
        id: 'queue-123',
        guildId: 'guild-123',
        name: 'test-queue',
      };

      // Mock db.select chain
      const whereMock = vi.fn().mockResolvedValue([mockQueue]);
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock });

      const result = await queueManager.getQueueByName('guild-123', 'test-queue');

      expect(result).toEqual(mockQueue);
    });

    it('should return null if queue does not exist', async () => {
      // Mock db.select chain
      const whereMock = vi.fn().mockResolvedValue([]);
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock });

      const result = await queueManager.getQueueByName('guild-123', 'non-existent');

      expect(result).toBeNull();
    });
  });

  describe('toggleLock', () => {
    it('should toggle lock state successfully', async () => {
      const mockQueue = {
        id: 'queue-123',
        guildId: 'guild-123',
        name: 'test-queue',
        isLocked: true,
      };

      // Mock db.update chain
      const returningMock = vi.fn().mockResolvedValue([mockQueue]);
      const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
      const setMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.update as any).mockReturnValue({ set: setMock });

      await queueManager.toggleLock('guild-123', 'test-queue', true);

      expect(db.update).toHaveBeenCalledWith(queues);
      expect(setMock).toHaveBeenCalledWith({ isLocked: true });
    });

    it('should throw QueueNotFoundError if queue does not exist', async () => {
      // Mock db.update chain
      const returningMock = vi.fn().mockResolvedValue([]);
      const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
      const setMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.update as any).mockReturnValue({ set: setMock });

      await expect(queueManager.toggleLock('guild-123', 'non-existent', true))
        .rejects.toThrow('Queue "non-existent" not found');
    });
  });

  describe('setWaitingRoom', () => {
    it('should set waiting room successfully', async () => {
      const mockQueue = {
        id: 'queue-123',
        guildId: 'guild-123',
        name: 'test-queue',
        waitingRoomId: 'channel-123',
      };

      // Mock db.update chain
      const returningMock = vi.fn().mockResolvedValue([mockQueue]);
      const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
      const setMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.update as any).mockReturnValue({ set: setMock });

      await queueManager.setWaitingRoom('guild-123', 'test-queue', 'channel-123');

      expect(db.update).toHaveBeenCalledWith(queues);
      expect(setMock).toHaveBeenCalledWith({ waitingRoomId: 'channel-123' });
    });
  });

  describe('setLogChannel', () => {
    it('should set log channel successfully', async () => {
      const mockQueue = {
        id: 'queue-123',
        guildId: 'guild-123',
        name: 'test-queue',
        logChannelId: 'channel-456',
      };

      // Mock db.update chain
      const returningMock = vi.fn().mockResolvedValue([mockQueue]);
      const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
      const setMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.update as any).mockReturnValue({ set: setMock });

      await queueManager.setLogChannel('guild-123', 'test-queue', 'channel-456');

      expect(db.update).toHaveBeenCalledWith(queues);
      expect(setMock).toHaveBeenCalledWith({ logChannelId: 'channel-456' });
    });
  });
});
