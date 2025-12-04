import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GuildManager } from '@managers/GuildManager';
import { Guild, Collection } from 'discord.js';
import db, { guilds } from '@db';

// Mock bot - use factory function to avoid hoisting issues
vi.mock('@/bot', () => ({
  bot: {
    guilds: {
      cache: new Collection()
    }
  }
}));

// Mock db
vi.mock('@db', () => ({
  default: {
    insert: vi.fn(),
    select: vi.fn(),
  },
  guilds: {
    id: "id",
  }
}));

// Mock logger
vi.mock('@utils/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('GuildManager', () => {
  let guildManager: GuildManager;

  beforeEach(async () => {
    guildManager = new GuildManager();
    // Import bot after mocks are set up
    const { bot } = await import('@/bot');
    bot.guilds.cache.clear();
    vi.clearAllMocks();
  });

  describe('syncAllGuilds', () => {
    it('should sync guilds successfully', async () => {
      const { bot } = await import('@/bot');
      const mockGuild = { id: 'guild-123', name: 'Test Guild', memberCount: 10 };
      (bot.guilds.cache as any).set(mockGuild.id, mockGuild);

      // Mock db.select (existing guilds)
      const fromMock = vi.fn().mockResolvedValue([]);
      (db.select as any).mockReturnValue({ from: fromMock });

      // Mock db.insert
      const onConflictDoNothingMock = vi.fn().mockResolvedValue([]);
      const valuesMock = vi.fn().mockReturnValue({ onConflictDoNothing: onConflictDoNothingMock });
      (db.insert as any).mockReturnValue({ values: valuesMock });

      await guildManager.syncAllGuilds();

      expect(db.insert).toHaveBeenCalledWith(guilds);
      expect(valuesMock).toHaveBeenCalledWith({
        id: mockGuild.id,
        name: mockGuild.name,
        memberCount: mockGuild.memberCount,
      });
    });

    it('should not add existing guilds', async () => {
      const { bot } = await import('@/bot');
      const mockGuild = { id: 'guild-123', name: 'Test Guild', memberCount: 10 };
      (bot.guilds.cache as any).set(mockGuild.id, mockGuild);

      // Mock db.select (existing guilds)
      const fromMock = vi.fn().mockResolvedValue([{ id: 'guild-123' }]);
      (db.select as any).mockReturnValue({ from: fromMock });

      await guildManager.syncAllGuilds();

      expect(db.insert).not.toHaveBeenCalled();
    });
  });

  describe('addGuild', () => {
    it('should add guild successfully', async () => {
      const mockGuild = { id: 'guild-123', name: 'Test Guild', memberCount: 10 } as unknown as Guild;

      // Mock db.insert
      const onConflictDoNothingMock = vi.fn().mockResolvedValue([]);
      const valuesMock = vi.fn().mockReturnValue({ onConflictDoNothing: onConflictDoNothingMock });
      (db.insert as any).mockReturnValue({ values: valuesMock });

      await guildManager.addGuild(mockGuild);

      expect(db.insert).toHaveBeenCalledWith(guilds);
      expect(valuesMock).toHaveBeenCalledWith({
        id: mockGuild.id,
        name: mockGuild.name,
        memberCount: mockGuild.memberCount,
      });
    });
  });
});
