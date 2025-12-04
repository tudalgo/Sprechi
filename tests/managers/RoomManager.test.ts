import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RoomManager } from '@managers/RoomManager';
import { Guild, VoiceChannel, ChannelType, PermissionFlagsBits } from 'discord.js';
import { mockDeep } from 'vitest-mock-extended';

// Mock logger
vi.mock('@utils/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('RoomManager', () => {
  let roomManager: RoomManager;
  let mockGuild: any;

  beforeEach(() => {
    roomManager = new RoomManager();
    mockGuild = mockDeep<Guild>();
    mockGuild.id = 'guild-123';
    mockGuild.channels.cache = [];
    mockGuild.channels.create = vi.fn();
    mockGuild.members.fetch = vi.fn();
    vi.clearAllMocks();
  });

  describe('createEphemeralChannel', () => {
    it('should create a channel successfully', async () => {
      const baseName = 'test-room';
      const userIds = ['user-1', 'user-2'];
      const categoryId = 'category-123';
      const mockChannel = { id: 'channel-123', name: baseName };

      mockGuild.channels.cache.some = vi.fn().mockReturnValue(false);
      mockGuild.channels.create.mockResolvedValue(mockChannel);
      mockGuild.members.fetch.mockResolvedValue({
        voice: { channel: true, setChannel: vi.fn() },
      });

      const result = await roomManager.createEphemeralChannel(mockGuild, baseName, userIds, categoryId);

      expect(mockGuild.channels.create).toHaveBeenCalledWith(expect.objectContaining({
        name: baseName,
        type: ChannelType.GuildVoice,
        parent: categoryId,
        permissionOverwrites: expect.arrayContaining([
          expect.objectContaining({ id: 'guild-123', deny: [PermissionFlagsBits.ViewChannel] }),
          expect.objectContaining({ id: 'user-1', allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] }),
        ]),
      }));
      expect(result).toEqual(mockChannel);
    });

    it('should handle duplicate names', async () => {
      const baseName = 'test-room';
      const mockChannel = { id: 'channel-123', name: `${baseName}-1` };

      // First call returns true (exists), second returns false
      mockGuild.channels.cache.some = vi.fn()
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);

      mockGuild.channels.create.mockResolvedValue(mockChannel);
      mockGuild.members.fetch.mockResolvedValue({
        voice: { channel: true, setChannel: vi.fn() },
      });

      const result = await roomManager.createEphemeralChannel(mockGuild, baseName, [], undefined);

      expect(mockGuild.channels.create).toHaveBeenCalledWith(expect.objectContaining({
        name: `${baseName}-1`,
      }));
      expect(result).toEqual(mockChannel);
    });

    it('should handle errors during creation', async () => {
      mockGuild.channels.create.mockRejectedValue(new Error('Failed to create'));

      const result = await roomManager.createEphemeralChannel(mockGuild, 'test', [], undefined);

      expect(result).toBeNull();
    });
  });

  describe('deleteChannel', () => {
    it('should delete channel successfully', async () => {
      const mockChannel = mockDeep<VoiceChannel>();
      mockChannel.delete.mockResolvedValue(mockChannel);

      await roomManager.deleteChannel(mockChannel);

      expect(mockChannel.delete).toHaveBeenCalled();
    });

    it('should handle errors during deletion', async () => {
      const mockChannel = mockDeep<VoiceChannel>();
      mockChannel.delete.mockRejectedValue(new Error('Failed to delete'));

      await roomManager.deleteChannel(mockChannel);

      expect(mockChannel.delete).toHaveBeenCalled();
    });
  });
});
