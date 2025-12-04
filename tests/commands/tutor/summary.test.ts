import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TutorSummaryCommand } from '@commands/tutor/summary';
import { CommandInteraction, MessageFlags, Colors } from 'discord.js';
import { mockDeep } from 'vitest-mock-extended';

// Mock db
vi.mock('@db', () => ({
  default: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn(),
  },
}));
import db from '@db';

// Mock logger
vi.mock('@utils/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('TutorSummaryCommand', () => {
  let tutorSummaryCommand: TutorSummaryCommand;
  let mockInteraction: any;

  beforeEach(() => {
    tutorSummaryCommand = new TutorSummaryCommand();

    mockInteraction = mockDeep<CommandInteraction>();
    mockInteraction.user = { tag: 'tutor', id: 'tutor-123' };
    mockInteraction.guild = { id: 'guild-123', name: 'Test Guild' };
    mockInteraction.deferReply = vi.fn();
    mockInteraction.editReply = vi.fn();
    mockInteraction.reply = vi.fn();
  });

  it('should show tutor summary successfully', async () => {
    const startTime1 = new Date(Date.now() - 3600000); // 1 hour ago
    const endTime1 = new Date();

    const mockSessions = [
      { id: 'session-1', startTime: startTime1.toISOString(), endTime: endTime1.toISOString() },
    ];

    // Mock sessions query
    ((db as any).where as any).mockResolvedValueOnce(mockSessions);

    // Mock students query (called once per session)
    ((db as any).where as any).mockResolvedValueOnce([{ count: 3 }]);

    await tutorSummaryCommand.summary(mockInteraction);

    expect(mockInteraction.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
    expect(mockInteraction.editReply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Tutor Summary',
            fields: expect.arrayContaining([
              expect.objectContaining({ name: 'Total Sessions', value: '1' }),
              expect.objectContaining({ name: 'Total Time', value: '1h 0m' }),
              expect.objectContaining({ name: 'Students Helped', value: '3' }),
            ]),
            color: Colors.Blue,
          }),
        }),
      ]),
    }));
  });

  it('should handle errors', async () => {
    ((db as any).where as any).mockRejectedValue(new Error("DB Error"));

    await tutorSummaryCommand.summary(mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      content: "An error occurred while fetching your summary."
    });
  });
});
