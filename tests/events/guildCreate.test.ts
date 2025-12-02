import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GuildCreateEvent } from '@events/guildCreate';
import { GuildManager } from '@managers/GuildManager';
import { Guild } from 'discord.js';
import { mockDeep } from 'vitest-mock-extended';

// Mock GuildManager
vi.mock('@managers/GuildManager');

// Mock logger
vi.mock('@utils/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('GuildCreateEvent', () => {
  let guildCreateEvent: GuildCreateEvent;
  let mockGuildManager: any;
  let mockGuild: any;

  beforeEach(() => {
    mockGuildManager = mockDeep<GuildManager>();
    (GuildManager as any).mockImplementation(function () { return mockGuildManager });

    guildCreateEvent = new GuildCreateEvent();
    mockGuild = { id: 'guild-123', name: 'Test Guild' };

    vi.clearAllMocks();
  });

  it('should add guild on join', async () => {
    await guildCreateEvent.onGuildJoin([mockGuild]);

    expect(mockGuildManager.addGuild).toHaveBeenCalledWith(mockGuild);
  });
});
