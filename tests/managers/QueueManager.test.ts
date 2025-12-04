import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueueManager } from '@managers/QueueManager';
import db from '@db';
import { queues, queueMembers, sessions } from '@db/schema';
import { bot } from '@/bot';
import { mockDeep, mockReset } from 'vitest-mock-extended';
import { RoomManager } from '@managers/RoomManager';

// Mock RoomManager
vi.mock('@managers/RoomManager');

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

// Mock bot
vi.mock('@/bot', () => ({
  bot: {
    users: {
      fetch: vi.fn(),
    },
    guilds: {
      fetch: vi.fn(),
    },
    channels: {
      fetch: vi.fn(),
    },
  },
}));

describe('QueueManager', () => {
  let queueManager: QueueManager;
  let mockRoomManager: any;

  beforeEach(() => {
    queueManager = new QueueManager();
    mockRoomManager = mockDeep<RoomManager>();
    vi.clearAllMocks();
  });

  describe('processStudentPick', () => {
    it('should process student pick successfully', async () => {
      const mockQueue = {
        name: 'test-queue',
        waitingRoomId: 'waiting-room-123',
      };
      const mockSession = { id: 'session-123' };
      const mockInteraction = {
        user: { username: 'tutor', tag: 'tutor#123' },
        guild: {
          channels: { fetch: vi.fn().mockResolvedValue({ parentId: 'category-123' }) },
          members: { fetch: vi.fn().mockResolvedValue({ voice: { channel: true, setChannel: vi.fn() } }) },
          id: 'guild-123',
        },
        editReply: vi.fn(),
      };
      const mockChannel = { id: 'channel-123' };

      mockRoomManager.createEphemeralChannel.mockResolvedValue(mockChannel);
      vi.spyOn(queueManager, 'pickStudent').mockResolvedValue(undefined);

      await queueManager.processStudentPick(
        mockInteraction as any,
        mockRoomManager,
        mockQueue as any,
        mockSession as any,
        'student-123',
        'tutor-123'
      );

      expect(mockRoomManager.createEphemeralChannel).toHaveBeenCalled();
      expect(queueManager.pickStudent).toHaveBeenCalled();
    });

    it('should throw QueueError if channel creation fails', async () => {
      const mockQueue = {
        name: 'test-queue',
        waitingRoomId: 'waiting-room-123',
      };
      const mockSession = { id: 'session-123' };
      const mockInteraction = {
        user: { username: 'tutor', tag: 'tutor#123' },
        guild: {
          channels: { fetch: vi.fn().mockResolvedValue({ parentId: 'category-123' }) },
        },
      };

      mockRoomManager.createEphemeralChannel.mockResolvedValue(null);

      await expect(queueManager.processStudentPick(
        mockInteraction as any,
        mockRoomManager,
        mockQueue as any,
        mockSession as any,
        'student-123',
        'tutor-123'
      )).rejects.toThrow('Failed to create session room.');
    });

    it('should continue if moving tutor fails', async () => {
      const mockQueue = {
        name: 'test-queue',
        waitingRoomId: 'waiting-room-123',
      };
      const mockSession = { id: 'session-123' };
      const mockInteraction = {
        user: { username: 'tutor', tag: 'tutor#123' },
        guild: {
          channels: { fetch: vi.fn().mockResolvedValue({ parentId: 'category-123' }) },
          members: {
            fetch: vi.fn().mockResolvedValue({
              voice: {
                channel: true,
                setChannel: vi.fn().mockRejectedValue(new Error('Move failed')),
              },
            }),
          },
          id: 'guild-123',
        },
        editReply: vi.fn(),
      };
      const mockChannel = { id: 'channel-123' };

      mockRoomManager.createEphemeralChannel.mockResolvedValue(mockChannel);
      vi.spyOn(queueManager, 'pickStudent').mockResolvedValue(undefined);

      await queueManager.processStudentPick(
        mockInteraction as any,
        mockRoomManager,
        mockQueue as any,
        mockSession as any,
        'student-123',
        'tutor-123'
      );

      expect(queueManager.pickStudent).toHaveBeenCalled();
    });
  });

  describe('resolveQueue', () => {
    it('should resolve queue by name', async () => {
      const mockQueue = { name: 'test-queue' };
      vi.spyOn(queueManager, 'getQueueByName').mockResolvedValue(mockQueue as any);

      const result = await queueManager.resolveQueue('guild-123', 'test-queue');
      expect(result).toEqual(mockQueue);
    });

    it('should throw QueueNotFoundError if queue name provided but not found', async () => {
      vi.spyOn(queueManager, 'getQueueByName').mockResolvedValue(null as any);

      await expect(queueManager.resolveQueue('guild-123', 'non-existent'))
        .rejects.toThrow('Queue "non-existent" not found');
    });

    it('should resolve single queue if no name provided', async () => {
      const mockQueue = { name: 'test-queue' };
      vi.spyOn(queueManager, 'listQueues').mockResolvedValue([mockQueue] as any);

      const result = await queueManager.resolveQueue('guild-123');
      expect(result).toEqual(mockQueue);
    });

    it('should throw error if multiple queues and no name provided', async () => {
      vi.spyOn(queueManager, 'listQueues').mockResolvedValue([{}, {}] as any);

      await expect(queueManager.resolveQueue('guild-123'))
        .rejects.toThrow('Multiple queues found. Please specify a queue name.');
    });

    it('should throw error if no queues found', async () => {
      vi.spyOn(queueManager, 'listQueues').mockResolvedValue([]);
      await expect(queueManager.resolveQueue('guild-123'))
        .rejects.toThrow('No queues found in this server.');
    });
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

    it('should throw QueueNotFoundError if queue does not exist', async () => {
      // Mock db.update chain
      const returningMock = vi.fn().mockResolvedValue([]);
      const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
      const setMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.update as any).mockReturnValue({ set: setMock });

      await expect(queueManager.setWaitingRoom('guild-123', 'non-existent', 'channel-123'))
        .rejects.toThrow('Queue "non-existent" not found');
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

    it('should throw QueueNotFoundError if queue does not exist', async () => {
      // Mock db.update chain
      const returningMock = vi.fn().mockResolvedValue([]);
      const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
      const setMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.update as any).mockReturnValue({ set: setMock });

      await expect(queueManager.setLogChannel('guild-123', 'non-existent', 'channel-456'))
        .rejects.toThrow('Queue "non-existent" not found');
    });
  });
  describe('listQueues', () => {
    it('should list queues with stats', async () => {
      const mockQueue = {
        id: 'queue-123',
        guildId: 'guild-123',
        name: 'test-queue',
        memberCount: 5,
        sessionCount: 2,
      };

      const mockDbResult = [{
        queue: { ...mockQueue },
        memberCount: 5,
        sessionCount: 2,
      }];

      // Mock db chain for listQueues
      const groupByMock = vi.fn().mockResolvedValue(mockDbResult);
      const whereMock = vi.fn().mockReturnValue({ groupBy: groupByMock });
      const leftJoin2Mock = vi.fn().mockReturnValue({ where: whereMock });
      const leftJoin1Mock = vi.fn().mockReturnValue({ leftJoin: leftJoin2Mock });
      const fromMock = vi.fn().mockReturnValue({ leftJoin: leftJoin1Mock });
      (db.select as any).mockReturnValue({ from: fromMock });

      const result = await queueManager.listQueues('guild-123');

      expect(result).toEqual([mockQueue]);
    });
  });

  describe('deleteQueue', () => {
    it('should delete a queue successfully', async () => {
      // Mock db.delete chain
      const returningMock = vi.fn().mockResolvedValue([{ id: 'queue-123' }]);
      const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
      (db.delete as any).mockReturnValue({ where: whereMock });

      const result = await queueManager.deleteQueue('guild-123', 'test-queue');

      expect(result).toBe(true);
    });

    it('should return false if queue not found', async () => {
      // Mock db.delete chain
      const returningMock = vi.fn().mockResolvedValue([]);
      const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
      (db.delete as any).mockReturnValue({ where: whereMock });

      const result = await queueManager.deleteQueue('guild-123', 'non-existent');

      expect(result).toBe(false);
    });
  });

  describe('joinQueue', () => {
    it('should join queue successfully', async () => {
      const mockQueue = {
        id: 'queue-123',
        guildId: 'guild-123',
        name: 'test-queue',
        isLocked: false,
      };

      // Mock getQueueByName
      vi.spyOn(queueManager, 'getQueueByName').mockResolvedValue(mockQueue as any);

      // Mock existing member check (not in queue)
      const whereMock = vi.fn().mockResolvedValue([]);
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock });

      // Mock db.insert
      (db.insert as any).mockReturnValue({ values: vi.fn().mockResolvedValue([]) });

      // Mock logToChannel and sendJoinDm
      const logToChannel = vi.spyOn(queueManager as any, 'logToChannel');
      const sendJoinDm = vi.spyOn(queueManager as any, 'sendJoinDm');

      await queueManager.joinQueue('guild-123', 'test-queue', 'user-123');

      expect(db.insert).toHaveBeenCalled();
      expect(logToChannel).toHaveBeenCalled();
      expect(sendJoinDm).toHaveBeenCalled();
    });

    it('should throw QueueNotFoundError if queue does not exist', async () => {
      vi.spyOn(queueManager, 'getQueueByName').mockResolvedValue(null as any);

      await expect(queueManager.joinQueue('guild-123', 'non-existent', 'user-123'))
        .rejects.toThrow('Queue "non-existent" not found');
    });

    it('should throw QueueLockedError if queue is locked', async () => {
      const mockQueue = {
        id: 'queue-123',
        guildId: 'guild-123',
        name: 'test-queue',
        isLocked: true,
      };

      vi.spyOn(queueManager, 'getQueueByName').mockResolvedValue(mockQueue as any);

      await expect(queueManager.joinQueue('guild-123', 'test-queue', 'user-123'))
        .rejects.toThrow('Queue "test-queue" is locked');
    });

    it('should throw AlreadyInQueueError if user is already in queue and active', async () => {
      const mockQueue = {
        id: 'queue-123',
        guildId: 'guild-123',
        name: 'test-queue',
        isLocked: false,
      };

      vi.spyOn(queueManager, 'getQueueByName').mockResolvedValue(mockQueue as any);

      // Mock existing member check (active)
      const mockMember = { id: 'member-123', leftAt: null };
      const whereMock = vi.fn().mockResolvedValue([mockMember]);
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock });

      await expect(queueManager.joinQueue('guild-123', 'test-queue', 'user-123'))
        .rejects.toThrow('Already in queue "test-queue"');
    });

    it('should restore position if rejoining within grace period', async () => {
      const mockQueue = {
        id: 'queue-123',
        guildId: 'guild-123',
        name: 'test-queue',
        isLocked: false,
      };

      vi.spyOn(queueManager, 'getQueueByName').mockResolvedValue(mockQueue as any);

      // Mock existing member check (left recently)
      const leftAt = new Date(); // Just left
      const mockMember = { id: 'member-123', leftAt: leftAt.toISOString() };
      const whereMock = vi.fn().mockResolvedValue([mockMember]);
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock });

      // Mock db.update
      const setMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
      (db.update as any).mockReturnValue({ set: setMock });

      const logToChannel = vi.spyOn(queueManager as any, 'logToChannel');
      const sendJoinDm = vi.spyOn(queueManager as any, 'sendJoinDm');

      await queueManager.joinQueue('guild-123', 'test-queue', 'user-123');

      expect(db.update).toHaveBeenCalledWith(queueMembers);
      expect(setMock).toHaveBeenCalledWith({ leftAt: null });
      expect(logToChannel).toHaveBeenCalledWith(mockQueue, expect.stringContaining('restored position'));
      expect(sendJoinDm).toHaveBeenCalled();
    });

    it('should treat as new join if rejoining after grace period', async () => {
      const mockQueue = {
        id: 'queue-123',
        guildId: 'guild-123',
        name: 'test-queue',
        isLocked: false,
      };

      vi.spyOn(queueManager, 'getQueueByName').mockResolvedValue(mockQueue as any);

      // Mock existing member check (left long ago)
      const leftAt = new Date(Date.now() - 70000); // 70s ago
      const mockMember = { id: 'member-123', leftAt: leftAt.toISOString() };
      const whereMock = vi.fn().mockResolvedValue([mockMember]);
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock });

      // Mock db.delete
      (db.delete as any).mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
      // Mock db.insert
      (db.insert as any).mockReturnValue({ values: vi.fn().mockResolvedValue([]) });

      const logToChannel = vi.spyOn(queueManager as any, 'logToChannel');
      const sendJoinDm = vi.spyOn(queueManager as any, 'sendJoinDm');

      await queueManager.joinQueue('guild-123', 'test-queue', 'user-123');

      expect(logToChannel).toHaveBeenCalledWith(mockQueue, expect.stringContaining('joined the queue'));
      expect(sendJoinDm).toHaveBeenCalled();
    });

    it('should not throw if DM fails', async () => {
      const mockQueue = {
        id: 'queue-123',
        guildId: 'guild-123',
        name: 'test-queue',
        isLocked: false,
      };

      vi.spyOn(queueManager, 'getQueueByName').mockResolvedValue(mockQueue as any);

      // Mock not in queue
      const whereMock = vi.fn().mockResolvedValue([]);
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock });

      (db.insert as any).mockReturnValue({ values: vi.fn().mockResolvedValue([]) });

      // Mock DM failure
      (bot.users.fetch as any).mockResolvedValue({
        send: vi.fn().mockRejectedValue(new Error('DM failed')),
      });

      await expect(queueManager.joinQueue('guild-123', 'test-queue', 'user-123'))
        .resolves.not.toThrow();
    });

    it('should not throw if logToChannel fails', async () => {
      const mockQueue = {
        id: 'queue-123',
        guildId: 'guild-123',
        name: 'test-queue',
        isLocked: false,
        logChannelId: 'log-channel-123',
      };

      vi.spyOn(queueManager, 'getQueueByName').mockResolvedValue(mockQueue as any);

      // Mock not in queue
      const whereMock = vi.fn().mockResolvedValue([]);
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock });

      (db.insert as any).mockReturnValue({ values: vi.fn().mockResolvedValue([]) });

      // Mock log channel failure
      (bot.channels.fetch as any).mockRejectedValue(new Error('Channel fetch failed'));

      await expect(queueManager.joinQueue('guild-123', 'test-queue', 'user-123'))
        .resolves.not.toThrow();
    });
  });

  describe('leaveQueue', () => {
    it('should leave queue successfully', async () => {
      const mockQueue = {
        id: 'queue-123',
        guildId: 'guild-123',
        name: 'test-queue',
      };

      const mockMember = {
        id: 'member-123',
        userId: 'user-123',
      };

      vi.spyOn(queueManager, 'getQueueByName').mockResolvedValue(mockQueue as any);

      // Mock member check
      const whereMock = vi.fn().mockResolvedValue([mockMember]);
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock });

      // Mock db.update
      const whereUpdateMock = vi.fn().mockResolvedValue([]);
      const setMock = vi.fn().mockReturnValue({ where: whereUpdateMock });
      (db.update as any).mockReturnValue({ set: setMock });

      // Mock logToChannel
      const logToChannel = vi.spyOn(queueManager as any, 'logToChannel');

      await queueManager.leaveQueue('guild-123', 'test-queue', 'user-123');

      expect(db.update).toHaveBeenCalled();
      expect(logToChannel).toHaveBeenCalled();
    });

    it('should throw QueueNotFoundError if queue does not exist', async () => {
      vi.spyOn(queueManager, 'getQueueByName').mockResolvedValue(null as any);

      await expect(queueManager.leaveQueue('guild-123', 'non-existent', 'user-123'))
        .rejects.toThrow('Queue "non-existent" not found');
    });

    it('should throw NotInQueueError if user is not in queue', async () => {
      const mockQueue = {
        id: 'queue-123',
        guildId: 'guild-123',
        name: 'test-queue',
      };

      vi.spyOn(queueManager, 'getQueueByName').mockResolvedValue(mockQueue as any);

      // Mock member check
      const whereMock = vi.fn().mockResolvedValue([]);
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock });

      await expect(queueManager.leaveQueue('guild-123', 'test-queue', 'user-123'))
        .rejects.toThrow('Not in queue "test-queue"');
    });

    it('should disconnect user from waiting room if configured', async () => {
      const mockQueue = {
        id: 'queue-123',
        guildId: 'guild-123',
        name: 'test-queue',
        waitingRoomId: 'voice-123',
      };
      const mockMember = { id: 'member-123', userId: 'user-123' };

      vi.spyOn(queueManager, 'getQueueByName').mockResolvedValue(mockQueue as any);

      // Mock member check
      const whereMock = vi.fn().mockResolvedValue([mockMember]);
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock });

      // Mock db.update
      const setMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
      (db.update as any).mockReturnValue({ set: setMock });

      // Mock bot interactions
      const mockVoiceMember = {
        voice: {
          channelId: 'voice-123',
          disconnect: vi.fn().mockResolvedValue(undefined),
        },
      };
      const mockGuild = {
        members: {
          fetch: vi.fn().mockResolvedValue(mockVoiceMember),
        },
      };
      (bot.guilds.fetch as any).mockResolvedValue(mockGuild);
      (bot.users.fetch as any).mockResolvedValue({ send: vi.fn() });

      await queueManager.leaveQueue('guild-123', 'test-queue', 'user-123');

      expect(bot.guilds.fetch).toHaveBeenCalledWith('guild-123');
      expect(mockGuild.members.fetch).toHaveBeenCalledWith('user-123');
      expect(mockVoiceMember.voice.disconnect).toHaveBeenCalled();
    });

    it('should not throw if DM fails', async () => {
      const mockQueue = {
        id: 'queue-123',
        guildId: 'guild-123',
        name: 'test-queue',
      };
      const mockMember = { id: 'member-123', userId: 'user-123' };

      vi.spyOn(queueManager, 'getQueueByName').mockResolvedValue(mockQueue as any);

      const whereMock = vi.fn().mockResolvedValue([mockMember]);
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock });

      const setMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
      (db.update as any).mockReturnValue({ set: setMock });

      (bot.users.fetch as any).mockResolvedValue({
        send: vi.fn().mockRejectedValue(new Error('DM failed')),
      });

      await expect(queueManager.leaveQueue('guild-123', 'test-queue', 'user-123'))
        .resolves.not.toThrow();
    });

    it('should cleanup member after grace period', async () => {
      vi.useFakeTimers();
      const mockQueue = {
        id: 'queue-123',
        guildId: 'guild-123',
        name: 'test-queue',
      };
      const mockMember = { id: 'member-123', userId: 'user-123' };

      vi.spyOn(queueManager, 'getQueueByName').mockResolvedValue(mockQueue as any);

      // Initial check
      const whereMock = vi.fn().mockResolvedValue([mockMember]);
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock });

      const setMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
      (db.update as any).mockReturnValue({ set: setMock });

      await queueManager.leaveQueue('guild-123', 'test-queue', 'user-123');

      // Fast forward time
      const leftAt = new Date(Date.now() - 61000); // 61s ago
      const mockMemberExpired = { id: 'member-123', leftAt: leftAt.toISOString() };

      // Mock select inside setTimeout
      whereMock.mockResolvedValue([mockMemberExpired]);

      // Mock delete
      const whereDeleteMock = vi.fn().mockResolvedValue([]);
      (db.delete as any).mockReturnValue({ where: whereDeleteMock });

      vi.runAllTimers();

      // Wait for promises to resolve
      await Promise.resolve();
      await Promise.resolve();

      expect(db.delete).toHaveBeenCalledWith(queueMembers);

      vi.useRealTimers();
    });
  });

  describe('createSession', () => {
    it('should create session successfully', async () => {
      const mockQueue = {
        id: 'queue-123',
        guildId: 'guild-123',
        name: 'test-queue',
      };

      vi.spyOn(queueManager, 'getQueueByName').mockResolvedValue(mockQueue as any);

      // Mock active session check (none)
      const whereMock = vi.fn().mockResolvedValue([]);
      const innerJoinMock = vi.fn().mockReturnValue({ where: whereMock });
      const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoinMock });
      (db.select as any).mockReturnValue({ from: fromMock });

      // Mock db.insert
      (db.insert as any).mockReturnValue({ values: vi.fn().mockResolvedValue([]) });

      await queueManager.createSession('guild-123', 'test-queue', 'tutor-123');

      expect(db.insert).toHaveBeenCalled();
    });

    it('should throw SessionAlreadyActiveError if tutor has active session', async () => {
      const mockQueue = {
        id: 'queue-123',
        guildId: 'guild-123',
        name: 'test-queue',
      };

      vi.spyOn(queueManager, 'getQueueByName').mockResolvedValue(mockQueue as any);

      // Mock active session check (exists)
      const whereMock = vi.fn().mockResolvedValue([{ id: 'session-123' }]);
      const innerJoinMock = vi.fn().mockReturnValue({ where: whereMock });
      const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoinMock });
      (db.select as any).mockReturnValue({ from: fromMock });

      await expect(queueManager.createSession('guild-123', 'test-queue', 'tutor-123'))
        .rejects.toThrow('You already have an active session');
    });

    it('should throw QueueNotFoundError if queue does not exist', async () => {
      vi.spyOn(queueManager, 'getQueueByName').mockResolvedValue(null as any);
      await expect(queueManager.createSession('guild-123', 'non-existent', 'tutor-123'))
        .rejects.toThrow('Queue "non-existent" not found');
    });
  });

  describe('endSession', () => {
    it('should end session successfully', async () => {
      const mockSession = {
        session: { id: 'session-123' },
        queue: { id: 'queue-123', name: 'test-queue' },
      };

      vi.spyOn(queueManager, 'getActiveSession').mockResolvedValue(mockSession as any);

      // Mock db.update
      const returningMock = vi.fn().mockResolvedValue([{ id: 'session-123' }]);
      const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
      const setMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.update as any).mockReturnValue({ set: setMock });

      await queueManager.endSession('guild-123', 'tutor-123');

      expect(db.update).toHaveBeenCalled();
    });

    it('should throw error if no active session', async () => {
      vi.spyOn(queueManager, 'getActiveSession').mockResolvedValue(null as any);
      await expect(queueManager.endSession('guild-123', 'tutor-123'))
        .rejects.toThrow('You do not have an active session.');
    });
  });

  describe('getActiveSession', () => {
    it('should return active session', async () => {
      const mockSession = {
        session: { id: 'session-123' },
        queue: { id: 'queue-123' },
      };

      // Mock db.select chain
      const whereMock = vi.fn().mockResolvedValue([mockSession]);
      const innerJoinMock = vi.fn().mockReturnValue({ where: whereMock });
      const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoinMock });
      (db.select as any).mockReturnValue({ from: fromMock });

      const result = await queueManager.getActiveSession('guild-123', 'tutor-123');

      expect(result).toEqual(mockSession);
    });
  });

  describe('pickStudent', () => {
    it('should pick student successfully', async () => {
      const mockQueue = {
        id: 'queue-123',
        guildId: 'guild-123',
        name: 'test-queue',
      };

      vi.spyOn(queueManager, 'getQueueByName').mockResolvedValue(mockQueue as any);

      // Mock db.delete
      const whereDeleteMock = vi.fn().mockResolvedValue([]);
      (db.delete as any).mockReturnValue({ where: whereDeleteMock });

      // Mock db.insert
      (db.insert as any).mockReturnValue({ values: vi.fn().mockResolvedValue([]) });

      await queueManager.pickStudent('guild-123', 'test-queue', 'student-123', 'session-123', 'tutor-123', 'channel-123');

      expect(db.delete).toHaveBeenCalled();
      expect(db.insert).toHaveBeenCalled();
    });

    it('should not throw if DM fails', async () => {
      const mockQueue = {
        id: 'queue-123',
        guildId: 'guild-123',
        name: 'test-queue',
      };

      vi.spyOn(queueManager, 'getQueueByName').mockResolvedValue(mockQueue as any);

      (db.delete as any).mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
      (db.insert as any).mockReturnValue({ values: vi.fn().mockResolvedValue([]) });

      (bot.users.fetch as any).mockResolvedValue({
        send: vi.fn().mockRejectedValue(new Error('DM failed')),
      });

      await expect(queueManager.pickStudent('guild-123', 'test-queue', 'student-123', 'session-123', 'tutor-123', 'channel-123'))
        .resolves.not.toThrow();
    });

    it('should throw QueueNotFoundError if queue does not exist', async () => {
      vi.spyOn(queueManager, 'getQueueByName').mockResolvedValue(null as any);
      await expect(queueManager.pickStudent('guild-123', 'non-existent', 'student-123', 'session-123', 'tutor-123', 'channel-123'))
        .rejects.toThrow('Queue "non-existent" not found');
    });
  });

  describe('getQueueMembers', () => {
    it('should return queue members', async () => {
      const mockQueue = {
        id: 'queue-123',
        guildId: 'guild-123',
        name: 'test-queue',
      };

      vi.spyOn(queueManager, 'getQueueByName').mockResolvedValue(mockQueue as any);

      const mockMembers = [{ userId: 'user-1' }, { userId: 'user-2' }];

      // Mock db.select chain
      const orderByMock = vi.fn().mockResolvedValue(mockMembers);
      const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock });

      const result = await queueManager.getQueueMembers('guild-123', 'test-queue');

      expect(result).toEqual(mockMembers);
    });

    it('should respect limit', async () => {
      const mockQueue = { id: 'queue-123' };
      vi.spyOn(queueManager, 'getQueueByName').mockResolvedValue(mockQueue as any);

      const limitMock = vi.fn().mockResolvedValue([]);
      const orderByMock = vi.fn().mockReturnValue({ limit: limitMock });
      const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock });

      await queueManager.getQueueMembers('guild-123', 'test-queue', 5);
      expect(limitMock).toHaveBeenCalledWith(5);
    });

    it('should throw QueueNotFoundError if queue not found', async () => {
      vi.spyOn(queueManager, 'getQueueByName').mockResolvedValue(null as any);
      await expect(queueManager.getQueueMembers('guild-123', 'non-existent'))
        .rejects.toThrow('Queue "non-existent" not found');
    });
  });
  describe('getQueueByUser', () => {
    it('should return queue for user', async () => {
      const mockQueue = { id: 'queue-123' };
      const mockMember = { queue: mockQueue };

      // Mock db.select chain
      const whereMock = vi.fn().mockResolvedValue([mockMember]);
      const innerJoinMock = vi.fn().mockReturnValue({ where: whereMock });
      const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoinMock });
      (db.select as any).mockReturnValue({ from: fromMock });

      const result = await queueManager.getQueueByUser('guild-123', 'user-123');

      expect(result).toEqual(mockQueue);
    });
  });

  describe('getQueueByWaitingRoom', () => {
    it('should return queue by waiting room', async () => {
      const mockQueue = { id: 'queue-123' };

      // Mock db.select chain
      const whereMock = vi.fn().mockResolvedValue([mockQueue]);
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock });

      const result = await queueManager.getQueueByWaitingRoom('guild-123', 'channel-123');

      expect(result).toEqual(mockQueue);
    });
  });

  describe('getQueuePosition', () => {
    it('should return queue position', async () => {
      const mockMembers = [{ userId: 'user-1' }, { userId: 'user-2' }];

      // Mock db.select chain
      const orderByMock = vi.fn().mockResolvedValue(mockMembers);
      const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock });

      const result = await queueManager.getQueuePosition('queue-123', 'user-2');

      expect(result).toBe(2);
    });
  });

  describe('getQueueById', () => {
    it('should return queue by id', async () => {
      const mockQueue = { id: 'queue-123' };

      // Mock db.select chain
      const whereMock = vi.fn().mockResolvedValue([mockQueue]);
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock });

      const result = await queueManager.getQueueById('queue-123');

      expect(result).toEqual(mockQueue);
    });
  });

  describe('getQueueMember', () => {
    it('should return queue member', async () => {
      const mockMember = { id: 'member-123' };

      // Mock db.select chain
      const whereMock = vi.fn().mockResolvedValue([mockMember]);
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock });

      const result = await queueManager.getQueueMember('queue-123', 'user-123');

      expect(result).toEqual(mockMember);
    });
  });
  describe('getAllActiveSessions', () => {
    it('should return active sessions with stats', async () => {
      const mockSession = {
        id: 'session-123',
        queueId: 'queue-123',
        tutorId: 'tutor-123',
        startTime: new Date(),
        endTime: null,
      };
      const mockDbResult = [{
        session: mockSession,
        queueName: 'test-queue',
        studentCount: 3,
      }];

      // Mock db chain
      const groupByMock = vi.fn().mockResolvedValue(mockDbResult);
      const whereMock = vi.fn().mockReturnValue({ groupBy: groupByMock });
      const leftJoin2Mock = vi.fn().mockReturnValue({ where: whereMock });
      const innerJoinMock = vi.fn().mockReturnValue({ leftJoin: leftJoin2Mock });
      const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoinMock });
      (db.select as any).mockReturnValue({ from: fromMock });

      const result = await queueManager.getAllActiveSessions('guild-123');

      expect(result).toEqual([{
        ...mockSession,
        queueName: 'test-queue',
        studentCount: 3,
      }]);
    });
  });

  describe('terminateSessionsByUser', () => {
    it('should terminate sessions for user', async () => {
      const mockSession = { id: 'session-123', tutorId: 'tutor-123' };
      const mockQueue = { id: 'queue-123', name: 'test-queue', logChannelId: 'log-123' };
      const mockActiveSessions = [{ session: mockSession, queue: mockQueue }];

      // Mock select
      const whereSelectMock = vi.fn().mockResolvedValue(mockActiveSessions);
      const innerJoinMock = vi.fn().mockReturnValue({ where: whereSelectMock });
      const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoinMock });
      (db.select as any).mockReturnValue({ from: fromMock });

      // Mock update
      const whereUpdateMock = vi.fn().mockResolvedValue([]);
      const setMock = vi.fn().mockReturnValue({ where: whereUpdateMock });
      (db.update as any).mockReturnValue({ set: setMock });

      // Mock logToChannel
      const logToChannel = vi.spyOn(queueManager as any, 'logToChannel');

      const count = await queueManager.terminateSessionsByUser('guild-123', 'tutor-123');

      expect(count).toBe(1);
      expect(db.update).toHaveBeenCalledWith(sessions);
      expect(logToChannel).toHaveBeenCalled();
    });

    it('should return 0 if no sessions found', async () => {
      // Mock select empty
      const whereSelectMock = vi.fn().mockResolvedValue([]);
      const innerJoinMock = vi.fn().mockReturnValue({ where: whereSelectMock });
      const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoinMock });
      (db.select as any).mockReturnValue({ from: fromMock });

      const count = await queueManager.terminateSessionsByUser('guild-123', 'tutor-123');

      expect(count).toBe(0);
      expect(db.update).not.toHaveBeenCalled();
    });
  });

  describe('terminateAllSessions', () => {
    it('should terminate all sessions', async () => {
      const mockSession = { id: 'session-123', tutorId: 'tutor-123' };
      const mockQueue = { id: 'queue-123', name: 'test-queue', logChannelId: 'log-123' };
      const mockActiveSessions = [{ session: mockSession, queue: mockQueue }];

      // Mock select
      const whereSelectMock = vi.fn().mockResolvedValue(mockActiveSessions);
      const innerJoinMock = vi.fn().mockReturnValue({ where: whereSelectMock });
      const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoinMock });
      (db.select as any).mockReturnValue({ from: fromMock });

      // Mock update
      const whereUpdateMock = vi.fn().mockResolvedValue([]);
      const setMock = vi.fn().mockReturnValue({ where: whereUpdateMock });
      (db.update as any).mockReturnValue({ set: setMock });

      // Mock logToChannel
      const logToChannel = vi.spyOn(queueManager as any, 'logToChannel');

      const count = await queueManager.terminateAllSessions('guild-123');

      expect(count).toBe(1);
      expect(db.update).toHaveBeenCalledWith(sessions);
      expect(logToChannel).toHaveBeenCalled();
    });
  });

  describe('setQueueLockState', () => {
    it('should set lock state successfully', async () => {
      const mockQueue = { id: 'queue-123', isLocked: false, name: 'test-queue' };
      vi.spyOn(queueManager, 'getQueueByName').mockResolvedValue(mockQueue as any);

      // Mock update
      const whereUpdateMock = vi.fn().mockResolvedValue([]);
      const setMock = vi.fn().mockReturnValue({ where: whereUpdateMock });
      (db.update as any).mockReturnValue({ set: setMock });

      await queueManager.setQueueLockState('guild-123', 'test-queue', true);

      expect(db.update).toHaveBeenCalledWith(queues);
      expect(setMock).toHaveBeenCalledWith({ isLocked: true });
    });

    it('should throw QueueError if already in state', async () => {
      const mockQueue = { id: 'queue-123', isLocked: true, name: 'test-queue' };
      vi.spyOn(queueManager, 'getQueueByName').mockResolvedValue(mockQueue as any);

      await expect(queueManager.setQueueLockState('guild-123', 'test-queue', true))
        .rejects.toThrow('Queue "test-queue" is already locked.');
    });

    it('should throw QueueNotFoundError if queue not found', async () => {
      vi.spyOn(queueManager, 'getQueueByName').mockResolvedValue(null as any);

      await expect(queueManager.setQueueLockState('guild-123', 'test-queue', true))
        .rejects.toThrow('Queue "test-queue" not found');
    });
  });
});
