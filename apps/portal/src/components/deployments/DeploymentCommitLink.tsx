import { ExternalLink, GitCommit, Github, GitBranch } from 'lucide-react';
import { getCommitUrl, detectProvider } from '@/lib/repo-utils';
import { toast } from 'sonner';
import type { JSX } from 'react';

interface DeploymentCommitLinkProps {
  repositoryUrl: string | null | undefined;
  commitSha: string;
  short?: boolean;
}

function shortSha(sha: string): string {
  if (sha.length <= 7) return sha;
  return sha.slice(0, 7);
}

export function DeploymentCommitLink({
  repositoryUrl,
  commitSha,
  short = true,
}: DeploymentCommitLinkProps): JSX.Element {
  const url = getCommitUrl(repositoryUrl, commitSha);
  const provider = repositoryUrl ? detectProvider(repositoryUrl) : 'unknown';
  const Icon = provider === 'github' ? Github : provider === 'gitlab' ? GitBranch : GitCommit;
  const label = short ? shortSha(commitSha) : commitSha;

  if (!url) {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
        <GitCommit className="h-3 w-3" />
        {label}
      </span>
    );
  }

  const handleClick = (): void => {
    toast.success('Ouverture du commit…', { description: url });
  };

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className="group inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
      title={`Voir le commit ${commitSha} sur ${provider}`}
    >
      <Icon className="h-3 w-3" />
      <span className="underline-offset-2 group-hover:underline">{label}</span>
      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
    </a>
  );
}
