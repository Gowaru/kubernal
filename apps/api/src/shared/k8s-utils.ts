export interface K8sResourceNameInput {
  application: { name: string };
  environment: { type: string };
}

export function k8sResourceName(input: K8sResourceNameInput): string {
  const safe = input.application.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  return `${safe}-${input.environment.type}`.slice(0, 63);
}
