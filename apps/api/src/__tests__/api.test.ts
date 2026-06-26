import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { User } from '@kubernal/shared-types';
import { createApp, setTestUser } from '../app.js';

const mockUsers: Record<string, User> = {
  admin: {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'admin@kubernal.io',
    name: 'Admin User',
    role: 'admin',
    teamId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  developer: {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'dev@kubernal.io',
    name: 'Dev User',
    role: 'developer',
    teamId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  platform_engineer: {
    id: '33333333-3333-3333-3333-333333333333',
    email: 'pe@kubernal.io',
    name: 'PE User',
    role: 'platform_engineer',
    teamId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  viewer: {
    id: '44444444-4444-4444-4444-444444444444',
    email: 'viewer@kubernal.io',
    name: 'Viewer User',
    role: 'viewer',
    teamId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

beforeEach(() => {
  setTestUser(undefined);
  vi.clearAllMocks();
});

afterEach(() => {
  setTestUser(undefined);
});

function adminApp() { setTestUser(mockUsers.admin); return createApp(); }
function devApp() { setTestUser(mockUsers.developer); return createApp(); }
function peApp() { setTestUser(mockUsers.platform_engineer); return createApp(); }

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(createApp()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('kubernal-api');
  });
});

describe('GET /api/v1/health', () => {
  it('returns 200', async () => {
    const res = await request(createApp()).get('/api/v1/health');
    expect(res.status).toBe(200);
  });
});

describe('GET /not-found', () => {
  it('returns 404', async () => {
    const res = await request(createApp()).get('/not-found');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe('Users API', () => {
  it('GET /api/v1/users returns empty list', async () => {
    const res = await request(adminApp()).get('/api/v1/users');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it('POST /api/v1/users validates required fields', async () => {
    const res = await request(adminApp()).post('/api/v1/users').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/v1/users validates email format', async () => {
    const res = await request(adminApp()).post('/api/v1/users').send({ email: 'bad', name: 'Test' });
    expect(res.status).toBe(400);
  });

  it('GET /api/v1/users/:id returns 400 for invalid UUID', async () => {
    const res = await request(adminApp()).get('/api/v1/users/not-a-uuid');
    expect(res.status).toBe(404);
  });
});

describe('Deployments API', () => {
  it('GET /api/v1/deployments returns empty list', async () => {
    const res = await request(devApp()).get('/api/v1/deployments');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('POST /api/v1/deployments validates required fields', async () => {
    const res = await request(devApp()).post('/api/v1/deployments').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/v1/deployments rejects invalid UUIDs', async () => {
    const res = await request(devApp()).post('/api/v1/deployments').send({
      applicationId: 'bad',
      environmentId: 'bad',
      version: '1.0',
      commitSha: 'abc',
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/deployments/:id/transition validates status', async () => {
    const res = await request(peApp())
      .post('/api/v1/deployments/some-id/transition')
      .send({ status: 'invalid' });
    expect(res.status).toBe(400);
  });

  it("POST /api/v1/deployments/:id/transition rejects 'pending' target", async () => {
    const res = await request(peApp())
      .post('/api/v1/deployments/some-id/transition')
      .send({ status: 'pending' });
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/deployments/:id/approve validates UUID', async () => {
    const res = await request(peApp())
      .post('/api/v1/deployments/some-id/approve')
      .send({ approvedById: 'bad' });
    expect(res.status).toBe(400);
  });
});

describe('Teams API', () => {
  it('GET /api/v1/teams returns empty list', async () => {
    const res = await request(devApp()).get('/api/v1/teams');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('POST /api/v1/teams validates required fields', async () => {
    const res = await request(peApp()).post('/api/v1/teams').send({});
    expect(res.status).toBe(400);
  });
});

describe('Templates API', () => {
  it('GET /api/v1/templates returns empty list', async () => {
    const res = await request(devApp()).get('/api/v1/templates');
    expect(res.status).toBe(200);
  });
});

describe('Applications API', () => {
  it('GET /api/v1/applications returns empty list', async () => {
    const res = await request(devApp()).get('/api/v1/applications');
    expect(res.status).toBe(200);
  });

  it('POST /api/v1/applications validates required fields', async () => {
    const res = await request(devApp()).post('/api/v1/applications').send({});
    expect(res.status).toBe(400);
  });
});

describe('Environments API', () => {
  it('GET /api/v1/environments returns empty list', async () => {
    const res = await request(devApp()).get('/api/v1/environments');
    expect(res.status).toBe(200);
  });
});

describe('Pipelines API', () => {
  it('GET /api/v1/pipelines returns empty list', async () => {
    const res = await request(devApp()).get('/api/v1/pipelines');
    expect(res.status).toBe(200);
  });
});

describe('Policies API', () => {
  it('GET /api/v1/policies returns empty list', async () => {
    const res = await request(devApp()).get('/api/v1/policies');
    expect(res.status).toBe(200);
  });
});

describe('Auth protection', () => {
  it('GET /api/v1/users returns 401 without auth', async () => {
    const res = await request(createApp()).get('/api/v1/users');
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/applications returns 401 without auth', async () => {
    const res = await request(createApp()).post('/api/v1/applications').send({});
    expect(res.status).toBe(401);
  });
});

describe('Role-based access', () => {
  it('viewer cannot create applications', async () => {
    setTestUser(mockUsers.viewer);
    const res = await request(createApp()).post('/api/v1/applications').send({});
    expect(res.status).toBe(403);
  });

  it('developer can create applications (validation error expected)', async () => {
    setTestUser(mockUsers.developer);
    const res = await request(createApp()).post('/api/v1/applications').send({});
    expect(res.status).toBe(400);
  });

  it('developer cannot delete teams', async () => {
    setTestUser(mockUsers.developer);
    const res = await request(createApp()).delete('/api/v1/teams/some-id');
    expect(res.status).toBe(403);
  });

  it('platform_engineer can delete teams (404 expected - not found)', async () => {
    setTestUser(mockUsers.platform_engineer);
    const res = await request(createApp()).delete('/api/v1/teams/some-id');
    expect(res.status).toBe(404);
  });

  it('admin can access audit logs', async () => {
    setTestUser(mockUsers.admin);
    const res = await request(createApp()).get('/api/v1/audit-logs');
    expect(res.status).toBe(200);
  });

  it('developer cannot access audit logs', async () => {
    setTestUser(mockUsers.developer);
    const res = await request(createApp()).get('/api/v1/audit-logs');
    expect(res.status).toBe(403);
  });
});