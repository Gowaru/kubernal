export function k8sResourceName(appId: string, envId: string): string {
  const safe = appId.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  return `${safe}-${envId}`.slice(0, 63);
}
