import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminRoleSet } from '@commands/admin/role/set';
import { GuildManager } from '@managers/GuildManager';
import { InternalRole } from '@db';
import { CommandInteraction, Role } from 'discord.js';
import { mockDeep } from 'vitest-mock-extended';

vi.mock('@managers/GuildManager');
vi.mock('@db', () => ({
  InternalRole: {
    Admin: "admin",
    Tutor: "tutor",
    Verified: "verified",
    ActiveSession: "active_session",
  }
}));
vi.mock('@utils/logger');

describe('AdminRoleSet', () => {
  let command: AdminRoleSet;
  let mockGuildManager: any;
  let mockInteraction: any;

  beforeEach(() => {
    mockGuildManager = mockDeep<GuildManager>();
    command = new AdminRoleSet(mockGuildManager);
    mockInteraction = mockDeep<CommandInteraction>();
    mockInteraction.guild = { id: 'guild-1' };
    mockInteraction.reply = vi.fn();
  });

  it('should set role mapping', async () => {
    const mockRole = { id: 'role-1', name: 'Role 1', toString: () => '<@&role-1>' } as unknown as Role;

    await command.set(InternalRole.Admin, mockRole, mockInteraction);

    expect(mockGuildManager.setRole).toHaveBeenCalledWith('guild-1', InternalRole.Admin, 'role-1');
    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([expect.objectContaining({ data: expect.objectContaining({ title: 'Role Mapping Updated' }) })])
    }));
  });

  it('should fail if not in guild', async () => {
    mockInteraction.guild = null;
    await command.set(InternalRole.Admin, {} as Role, mockInteraction);
    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('only be used in a server') }));
  });

  it('should handle errors', async () => {
    mockGuildManager.setRole.mockRejectedValue(new Error('test error'));
    await command.set(InternalRole.Admin, {} as Role, mockInteraction);
    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([expect.objectContaining({ data: expect.objectContaining({ title: 'Error', description: 'An error occurred while setting the role mapping.' }) })])
    }));
  });
});
