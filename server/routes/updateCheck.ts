import { Router, type Request, type Response } from 'express';
import semver from 'semver';

const REPO_PATTERN = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;
const GH_ACCEPT = 'application/vnd.github+json';
const USER_AGENT = 'TerminalAI/1.0 (update-check)';
const CACHE_TTL_MS = 10 * 60 * 1000;

type Cached = {
  at: number;
  latestVersion: string | null;
  releaseUrl: string;
  source: 'release' | 'package_json' | 'none';
};

let cache: Cached | null = null;
let cacheKey = '';

function parseRepository(): { owner: string; repo: string } | null {
  const combined = (process.env.UPDATE_CHECK_REPOSITORY || '').trim();
  if (combined) {
    if (!REPO_PATTERN.test(combined)) return null;
    const [owner, repo] = combined.split('/');
    return { owner, repo };
  }
  const owner = (process.env.UPDATE_CHECK_OWNER || 'Haroon966').trim();
  const repo = (process.env.UPDATE_CHECK_REPO || 'Panes').trim();
  if (!/^[a-zA-Z0-9_.-]+$/.test(owner) || !/^[a-zA-Z0-9_.-]+$/.test(repo)) return null;
  return { owner, repo };
}

function branch(): string {
  const b = (process.env.UPDATE_CHECK_BRANCH || 'main').trim();
  return /^[a-zA-Z0-9_./-]+$/.test(b) ? b : 'main';
}

function coerceVersion(v: string): string | null {
  const c = semver.coerce(v.replace(/^v/i, ''));
  return c ? c.version : null;
}

async function fetchLatestFromGitHub(
  owner: string,
  repo: string,
  br: string,
): Promise<{ latestVersion: string | null; releaseUrl: string; source: Cached['source'] }> {
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/latest`;
  const repoUrl = `https://github.com/${owner}/${repo}`;

  const releaseRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/releases/latest`,
    {
      headers: {
        Accept: GH_ACCEPT,
        'User-Agent': USER_AGENT,
      },
      signal: AbortSignal.timeout(12_000),
    },
  );

  if (releaseRes.ok) {
    const j = (await releaseRes.json()) as { tag_name?: string; html_url?: string };
    const tag = (j.tag_name || '').trim();
    const ver = tag ? coerceVersion(tag) : null;
    if (ver) {
      return {
        latestVersion: ver,
        releaseUrl: typeof j.html_url === 'string' && j.html_url ? j.html_url : releaseUrl,
        source: 'release',
      };
    }
  }

  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${br}/package.json`;
  const pkgRes = await fetch(rawUrl, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(12_000),
  });

  if (!pkgRes.ok) {
    return { latestVersion: null, releaseUrl: repoUrl, source: 'none' };
  }

  const pkg = (await pkgRes.json()) as { version?: string };
  const ver = typeof pkg.version === 'string' ? coerceVersion(pkg.version) : null;
  return {
    latestVersion: ver,
    releaseUrl,
    source: ver ? 'package_json' : 'none',
  };
}

export const updateCheckRouter = Router();

updateCheckRouter.get('/app/update-check', async (req: Request, res: Response) => {
  const checkedAt = new Date().toISOString();
  const localRaw = typeof req.query.local === 'string' ? req.query.local.trim() : '';
  const localVer = localRaw ? coerceVersion(localRaw) : null;

  const repo = parseRepository();
  if (!repo) {
    res.json({
      updateAvailable: false,
      latestVersion: null,
      releaseUrl: '',
      checkedAt,
      error: 'invalid_update_check_repository',
    });
    return;
  }

  const br = branch();
  const key = `${repo.owner}/${repo.repo}@${br}`;
  const now = Date.now();
  let remote: { latestVersion: string | null; releaseUrl: string; source: Cached['source'] };

  if (cache && cacheKey === key && now - cache.at < CACHE_TTL_MS) {
    remote = {
      latestVersion: cache.latestVersion,
      releaseUrl: cache.releaseUrl,
      source: cache.source,
    };
  } else {
    try {
      remote = await fetchLatestFromGitHub(repo.owner, repo.repo, br);
      cache = { at: now, ...remote };
      cacheKey = key;
    } catch {
      res.json({
        updateAvailable: false,
        latestVersion: null,
        releaseUrl: `https://github.com/${repo.owner}/${repo.repo}/releases/latest`,
        checkedAt,
        error: 'github_unreachable',
      });
      return;
    }
  }

  if (!remote.latestVersion || !localVer) {
    res.json({
      updateAvailable: false,
      latestVersion: remote.latestVersion,
      releaseUrl: remote.releaseUrl,
      checkedAt,
    });
    return;
  }

  const updateAvailable = semver.gt(remote.latestVersion, localVer);

  res.json({
    updateAvailable,
    latestVersion: remote.latestVersion,
    releaseUrl: remote.releaseUrl,
    checkedAt,
  });
});
