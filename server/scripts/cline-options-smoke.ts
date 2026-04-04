/**
 * Calls GET /api/agent/cline/options (API must be listening).
 * npm run test:cline
 */
export {};
const port = Number(process.env.PORT) || 3001;

const r = await fetch(`http://127.0.0.1:${port}/api/agent/cline/options`);
const j = await r.json();
console.log('[test:cline]', r.status, j);
