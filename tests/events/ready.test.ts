import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReadyEvent } from '@events/ready';
import { GuildManager } from '@managers/GuildManager';
import { Client } from 'discord.js';
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

describe('ReadyEvent', () => {
  let readyEvent: ReadyEvent;
  let mockGuildManager: any;
  let mockClient: any;

  beforeEach(() => {
    mockGuildManager = mockDeep<GuildManager>();
    (GuildManager as any).mockImplementation(function () { return mockGuildManager });

    readyEvent = new ReadyEvent();
    mockClient = mockDeep<Client>();
    mockClient.user = { tag: 'bot#123' };

    vi.clearAllMocks();
  });

  it('should sync guilds on ready', async () => {
    await readyEvent.onReady([mockClient]);

    expect(mockGuildManager.syncAllGuilds).toHaveBeenCalled();
  });
});
