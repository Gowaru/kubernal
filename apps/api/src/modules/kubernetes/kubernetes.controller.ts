import type { Request, Response } from 'express';
import { kubernetesService } from './kubernetes.service.js';
import {
  listPodsSchema,
  listServicesSchema,
  listEventsSchema,
  getArgoStatusSchema,
  listHPASchema,
  listClaimsSchema,
  getPodLogsParamsSchema,
  getPodLogsQuerySchema,
  scaleDeploymentParamsSchema,
  restartDeploymentParamsSchema,
  deleteDeploymentParamsSchema,
  deleteDeploymentQuerySchema,
  execInPodParamsSchema,
} from './kubernetes.schema.js';

export const kubernetesController = {
  async listPods(req: Request, res: Response) {
    const q = listPodsSchema.parse(req.query);
    const pods = await kubernetesService.listPods(q.namespace, q.labelSelector);
    res.json({ data: pods, total: pods.length, cluster: q.cluster });
  },

  async listServices(req: Request, res: Response) {
    const q = listServicesSchema.parse(req.query);
    const services = await kubernetesService.listServices(q.namespace);
    res.json({ data: services, total: services.length, cluster: q.cluster });
  },

  async listEvents(req: Request, res: Response) {
    const q = listEventsSchema.parse(req.query);
    const events = await kubernetesService.listEvents(q.namespace, q.limit);
    res.json({ data: events, total: events.length, cluster: q.cluster });
  },

  async getClusterInfo(_req: Request, res: Response) {
    const info = await kubernetesService.getClusterInfo();
    res.json({ data: info });
  },

  async getArgoStatus(req: Request, res: Response) {
    const q = getArgoStatusSchema.parse(req.query);
    const status = await kubernetesService.getArgoStatus(q.application);
    res.json({ data: status });
  },

  async listHPA(req: Request, res: Response) {
    const q = listHPASchema.parse(req.query);
    const hpas = await kubernetesService.listHPA(q.namespace);
    res.json({ data: hpas, total: hpas.length });
  },

  async listClaims(req: Request, res: Response) {
    const q = listClaimsSchema.parse(req.query);
    const claims = await kubernetesService.listClaims(q.namespace);
    res.json({ data: claims, total: claims.length });
  },

  async getPodLogs(req: Request, res: Response) {
    const params = getPodLogsParamsSchema.parse(req.params);
    const query = getPodLogsQuerySchema.parse(req.query);
    const logs = await kubernetesService.getPodLogs(params.namespace, params.name, {
      tailLines: query.tailLines,
      container: query.container,
    });
    res.json(logs);
  },

  async scaleDeployment(req: Request, res: Response) {
    const params = scaleDeploymentParamsSchema.parse(req.params);
    const body = req.body as { replicas: number };
    const result = await kubernetesService.scaleDeployment(params.namespace, params.name, body.replicas);
    res.json({ data: result });
  },

  async restartDeployment(req: Request, res: Response) {
    const params = restartDeploymentParamsSchema.parse(req.params);
    const result = await kubernetesService.restartDeployment(params.namespace, params.name);
    res.json({ data: result });
  },

  async deleteDeployment(req: Request, res: Response) {
    const params = deleteDeploymentParamsSchema.parse(req.params);
    const query = deleteDeploymentQuerySchema.parse(req.query);
    const result = await kubernetesService.deleteDeployment(params.namespace, params.name, {
      deleteService: query.deleteService,
    });
    res.json({ data: result });
  },

  async execInPod(req: Request, res: Response) {
    const params = execInPodParamsSchema.parse(req.params);
    const body = req.body as { command?: string[]; container?: string };
    const result = await kubernetesService.execInPod(params.namespace, params.name, {
      command: body.command,
      container: body.container,
    });
    res.json({ data: result });
  },
};
