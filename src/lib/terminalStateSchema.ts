import { z } from 'zod';

export const terminalPersistedStateSchema = z.object({
  sessions: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        title: z.string().min(0).max(256),
      })
    )
    .min(1),
  activeSessionId: z.string().min(1).max(64),
  focusedSessionId: z.string().min(1).max(64),
  layout: z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('tabs') }),
    z.object({
      mode: z.literal('split-h'),
      left: z.string().min(1).max(64),
      right: z.string().min(1).max(64),
    }),
    z.object({
      mode: z.literal('split-v'),
      top: z.string().min(1).max(64),
      bottom: z.string().min(1).max(64),
    }),
  ]),
});

export type TerminalPersistedState = z.infer<typeof terminalPersistedStateSchema>;
