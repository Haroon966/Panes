import { z } from 'zod';

const toolActivityCategorySchema = z.enum([
  'shell',
  'file_read',
  'file_write',
  'file_patch',
  'list',
  'find',
  'grep',
  'terminal',
  'other',
]);

export const agentTraceEntrySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('graph_phase'),
    phase: z.enum(['model', 'tool']),
    detail: z.string().max(2048).optional(),
    langgraphNode: z.string().max(256).optional(),
  }),
  z.object({
    kind: z.literal('tool'),
    callId: z.string().min(1).max(128),
    toolName: z.string().min(1).max(128),
    phase: z.enum(['running', 'awaiting_approval', 'done', 'error']),
    title: z.string().max(512).optional(),
    subtitle: z.string().max(8192).optional(),
    category: toolActivityCategorySchema.optional(),
    preview: z.string().max(2_000_000).optional(),
    error: z.string().max(2_000_000).optional(),
    secretHint: z.string().max(2048).optional(),
    elapsedMs: z.number().finite().nonnegative().optional(),
    approvalId: z.string().max(128).optional(),
  }),
]);

export type AgentTraceEntryPersisted = z.infer<typeof agentTraceEntrySchema>;

const agentTraceArraySchema = z.array(agentTraceEntrySchema).max(400);

const MAX_PREVIEW = 12_000;

function cap(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}… [truncated ${s.length - max} chars]`;
}

export function normalizeAgentTraceJson(raw: string | null | undefined): string {
  if (raw == null || raw === '') return '[]';
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return '[]';
  }
  const r = agentTraceArraySchema.safeParse(parsed);
  if (!r.success) return '[]';
  const clamped = r.data.map((e) => {
    if (e.kind !== 'tool') return e;
    return {
      ...e,
      ...(e.preview != null ? { preview: cap(e.preview, MAX_PREVIEW) } : {}),
      ...(e.error != null ? { error: cap(e.error, MAX_PREVIEW) } : {}),
      ...(e.subtitle != null ? { subtitle: cap(e.subtitle, 2048) } : {}),
    };
  });
  return JSON.stringify(clamped);
}

export function parseAgentTraceColumn(raw: string | null | undefined): AgentTraceEntryPersisted[] {
  const n = normalizeAgentTraceJson(raw ?? '[]');
  try {
    const parsed = JSON.parse(n) as unknown;
    const r = agentTraceArraySchema.safeParse(parsed);
    return r.success ? r.data : [];
  } catch {
    return [];
  }
}
