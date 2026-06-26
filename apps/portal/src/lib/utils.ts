import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "à l'instant";
  if (diffMins < 60) return `il y a ${diffMins} min`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `il y a ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `il y a ${diffDays}j`;
  return formatDate(date);
}

export function getEnvSlug(deployment: {
  environment?: { type?: string } | null;
  environmentId?: string | null;
  environmentName?: string | null;
}): string | null {
  if (deployment.environment?.type) return deployment.environment.type;
  const name = deployment.environmentName ?? deployment.environmentId ?? '';
  if (name.includes('-dev') || name.endsWith('-dev') || name === 'dev') return 'dev';
  if (name.includes('staging') || name === 'staging') return 'staging';
  if (name.includes('prod') || name === 'prod') return 'prod';
  return null;
}
