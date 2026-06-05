import type { Request, Response } from 'express';
import { kubernetesService } from './kubernetes.service.js';
import { listPodsSchema, listServicesSchema, listEventsSchema, getArgoStatusSchema, listHPASchema, listClaimsSchema } from './kubernetes.schema.js';

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
};
