export type RepoProvider = 'github' | 'gitlab' | 'bitbucket' | 'unknown';

export interface RepoParts {
  provider: RepoProvider;
  owner: string;
  repo: string;
  fullName: string;
}

const PROVIDER_PATTERNS: Array<{ provider: RepoProvider; host: RegExp }> = [
  { provider: 'github', host: /^https?:\/\/(www\.)?github\.com\// },
  { provider: 'gitlab', host: /^https?:\/\/(www\.)?gitlab\.com\// },
  { provider: 'bitbucket', host: /^https?:\/\/(www\.)?bitbucket\.org\// },
];

const REPO_REGEX = /^(https?:\/\/[^/]+\/)([^/]+)\/([^/]+?)(?:\.git)?\/?$/;

export function detectProvider(url: string): RepoProvider {
  for (const { provider, host } of PROVIDER_PATTERNS) {
    if (host.test(url)) return provider;
  }
  return 'unknown';
}

export function parseRepoUrl(url: string): RepoParts | null {
  const match = url.trim().match(REPO_REGEX);
  if (!match) return null;
  const owner = match[2] ?? '';
  const repo = match[3] ?? '';
  const provider = detectProvider(url);
  return {
    provider,
    owner,
    repo,
    fullName: `${owner}/${repo}`,
  };
}

export const REPO_URL_REGEX =
  /^https?:\/\/(www\.)?(github\.com|gitlab\.com|bitbucket\.org)\/[^/]+\/[^/]+?(\.git)?\/?$/;

export function isValidRepoUrl(url: string): boolean {
  return REPO_URL_REGEX.test(url.trim());
}

export function getCommitUrl(repoUrl: string | null | undefined, sha: string): string | null {
  if (!repoUrl) return null;
  const parts = parseRepoUrl(repoUrl);
  if (!parts) return null;
  switch (parts.provider) {
    case 'github':
      return `https://github.com/${parts.fullName}/commit/${sha}`;
    case 'gitlab':
      return `https://gitlab.com/${parts.fullName}/-/commit/${sha}`;
    case 'bitbucket':
      return `https://bitbucket.org/${parts.fullName}/commits/${sha}`;
    default:
      return null;
  }
}

export function getCompareUrl(
  repoUrl: string | null | undefined,
  baseSha: string,
  headSha: string,
): string | null {
  if (!repoUrl) return null;
  const parts = parseRepoUrl(repoUrl);
  if (!parts) return null;
  switch (parts.provider) {
    case 'github':
    case 'bitbucket':
      return `https://${parts.provider}.com/${parts.fullName}/compare/${baseSha}..${headSha}`;
    case 'gitlab':
      return `https://gitlab.com/${parts.fullName}/-/compare/${baseSha}...${headSha}`;
    default:
      return null;
  }
}

export function getRepoUrl(repoUrl: string | null | undefined): string | null {
  if (!repoUrl) return null;
  const parts = parseRepoUrl(repoUrl);
  if (!parts) return null;
  return `https://${parts.provider}.com/${parts.fullName}`;
}
