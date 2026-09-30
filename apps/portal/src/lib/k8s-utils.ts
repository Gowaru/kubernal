export function k8sResourceName(appId: string, envId: string): string {
  const safe = appId.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  return `${safe}-${envId}`.slice(0, 63);
}

/**
 * Nom de l'Application Argo CD rattachée à une application pour un type d'environnement.
 *
 * Miroir exact de `k8sResourceName({ application, environment })` de
 * `apps/api/src/shared/k8s-utils.ts` : c'est le nom que le backend utilise pour
 * chercher la ressource Argo CD (`GET /kubernetes/argo?application=<nom>`).
 * Source de vérité côté portail : toute requête Argo doit passer par cette fonction.
 */
export function argoApplicationName(appName: string, envType: string): string {
  return k8sResourceName(appName, envType);
}
