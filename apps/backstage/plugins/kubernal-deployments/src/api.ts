import { createApiRef } from "@backstage/core-plugin-api";

export interface Deployment {
  id: string;
  applicationId: string;
  environmentId: string;
  version: string;
  commitSha: string;
  status: string;
  trigger: string;
  createdAt: string;
  startedAt: string;
  completedAt: string | null;
}

export interface KubernalDeploymentsApi {
  getDeployments(): Promise<Deployment[]>;
  getDeploymentsByApplication(applicationId: string): Promise<Deployment[]>;
  createDeployment(data: {
    applicationId: string;
    environmentId: string;
    version: string;
    commitSha: string;
  }): Promise<Deployment>;
}

export const kubernalDeploymentsApiRef = createApiRef<KubernalDeploymentsApi>({
  id: "plugin.kubernal-deployments.service",
});

export class KubernalDeploymentsApiClient implements KubernalDeploymentsApi {
  private readonly baseUrl: string;

  constructor(options: { baseUrl?: string } = {}) {
    this.baseUrl = options.baseUrl ?? "/kubernal/api";
  }

  async getDeployments(): Promise<Deployment[]> {
    const response = await fetch(`${this.baseUrl}/deployments`);
    const data = await response.json();
    return data.data;
  }

  async getDeploymentsByApplication(
    applicationId: string,
  ): Promise<Deployment[]> {
    const response = await fetch(`${this.baseUrl}/deployments`);
    const data = await response.json();
    return data.data.filter(
      (d: Deployment) => d.applicationId === applicationId,
    );
  }

  async createDeployment(data: {
    applicationId: string;
    environmentId: string;
    version: string;
    commitSha: string;
  }): Promise<Deployment> {
    const response = await fetch(`${this.baseUrl}/deployments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    return result.data;
  }
}
