/**
 * Heuristic redaction of high-confidence secret patterns in agent-visible strings
 * (tool previews, errors, HITL result messages, read_workspace_file / outline tool text).
 * Not a full DLP engine.
 */

function scanDisabled(): boolean {
  const v = process.env.AGENT_DISABLE_SECRET_LEAK_SCAN?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export type RedactSecretsResult = {
  text: string;
  /** Human-readable labels for UI hint (e.g. "OpenAI-style API key"). */
  labels: string[];
};

type Rule = { label: string; repl: string; apply: (s: string) => { next: string; hit: boolean } };

function replaceAll(s: string, re: RegExp, repl: string): { next: string; hit: boolean } {
  let hit = false;
  const next = s.replace(re, () => {
    hit = true;
    return repl;
  });
  return { next, hit };
}

const RULES: Rule[] = [
  {
    label: 'PEM private key block',
    repl: '[REDACTED:private_key]',
    apply: (s) => {
      const re =
        /-----BEGIN [A-Z0-9 -]+PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 -]+PRIVATE KEY-----/g;
      return replaceAll(s, re, '[REDACTED:private_key]');
    },
  },
  {
    label: 'Anthropic API key',
    repl: '[REDACTED:api_key]',
    apply: (s) => replaceAll(s, /\bsk-ant-[a-zA-Z0-9_-]{10,}\b/gi, '[REDACTED:api_key]'),
  },
  {
    label: 'OpenAI project key',
    repl: '[REDACTED:api_key]',
    apply: (s) => replaceAll(s, /\bsk-proj-[a-zA-Z0-9_-]{10,}\b/g, '[REDACTED:api_key]'),
  },
  {
    label: 'Stripe secret key',
    repl: '[REDACTED:api_key]',
    apply: (s) =>
      replaceAll(s, /\bsk_(live|test)_[0-9a-zA-Z]{20,}\b/g, '[REDACTED:api_key]'),
  },
  {
    label: 'GitHub personal access token',
    repl: '[REDACTED:token]',
    apply: (s) => replaceAll(s, /\bghp_[A-Za-z0-9]{36,}\b/g, '[REDACTED:token]'),
  },
  {
    label: 'GitHub fine-grained token',
    repl: '[REDACTED:token]',
    apply: (s) => replaceAll(s, /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, '[REDACTED:token]'),
  },
  {
    label: 'AWS access key id',
    repl: '[REDACTED:aws_key]',
    apply: (s) => replaceAll(s, /\bAKIA[0-9A-Z]{16}\b/g, '[REDACTED:aws_key]'),
  },
  {
    label: 'AWS STS key id',
    repl: '[REDACTED:aws_key]',
    apply: (s) => replaceAll(s, /\bASIA[0-9A-Z]{16}\b/g, '[REDACTED:aws_key]'),
  },
  {
    label: 'Slack bot/user token',
    repl: '[REDACTED:token]',
    apply: (s) => replaceAll(s, /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, '[REDACTED:token]'),
  },
  {
    label: 'npm registry auth token',
    repl: '[REDACTED:npm_token]',
    apply: (s) =>
      replaceAll(s, /(\/\/[^\s]+\/:_authToken=)[^\s\n]+/g, '$1[REDACTED:npm_token]'),
  },
  {
    label: 'Google API key',
    repl: '[REDACTED:api_key]',
    apply: (s) => replaceAll(s, /\bAIza[0-9A-Za-z_-]{30,}\b/g, '[REDACTED:api_key]'),
  },
  {
    label: 'OpenAI-style API key',
    repl: '[REDACTED:api_key]',
    apply: (s) => replaceAll(s, /\bsk-[a-zA-Z0-9]{32,}\b/g, '[REDACTED:api_key]'),
  },
];

/**
 * Redact likely secrets; collect unique rule labels that fired.
 */
export function redactLikelySecrets(text: string): RedactSecretsResult {
  if (!text || scanDisabled()) {
    return { text, labels: [] };
  }
  const labels: string[] = [];
  const seen = new Set<string>();
  let out = text;
  for (const rule of RULES) {
    const { next, hit } = rule.apply(out);
    out = next;
    if (hit && !seen.has(rule.label)) {
      seen.add(rule.label);
      labels.push(rule.label);
    }
  }
  return { text: out, labels };
}

/** Hint line for tool_done events (joined for stream UI). */
export function formatSecretRedactionHint(labels: string[]): string | undefined {
  if (!labels.length) return undefined;
  return `Possible secret material was redacted from this preview: ${labels.join('; ')}.`;
}

/** Appended to read_workspace_file / outline tool text when redaction ran (model-visible). */
export function formatReadToolRedactionFootnote(labels: string[]): string {
  if (!labels.length) return '';
  return `\n\n[Server note: possible secret material was redacted (${labels.join('; ')}).]`;
}
