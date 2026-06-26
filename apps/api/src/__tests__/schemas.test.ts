import { describe, it, expect } from 'vitest';
import { createUserSchema, updateUserSchema } from '../modules/user/user.schema.js';
import {
  createApplicationSchema,
  updateApplicationSchema,
} from '../modules/application/application.schema.js';
import {
  createDeploymentSchema,
  transitionStatusSchema,
  approveDeploymentSchema,
  recordViolationsSchema,
} from '../modules/deployment/deployment.schema.js';
import { createTeamSchema } from '../modules/team/team.schema.js';
import { createTemplateSchema } from '../modules/template/template.schema.js';
import { createEnvironmentSchema } from '../modules/environment/environment.schema.js';
import { createPipelineSchema } from '../modules/pipeline/pipeline.schema.js';
import { createPolicySchema } from '../modules/policy/policy.schema.js';

const uuid = () => 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeef';

describe('User schemas', () => {
  describe('createUserSchema', () => {
    it('accepts valid input', () => {
      const result = createUserSchema.safeParse({ email: 'test@test.com', name: 'Test User' });
      expect(result.success).toBe(true);
    });

    it('accepts input with optional fields', () => {
      const result = createUserSchema.safeParse({
        email: 'test@test.com',
        name: 'Test User',
        role: 'platform_engineer',
        teamId: uuid(),
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid email', () => {
      const result = createUserSchema.safeParse({ email: 'not-an-email', name: 'Test' });
      expect(result.success).toBe(false);
    });

    it('rejects empty name', () => {
      const result = createUserSchema.safeParse({ email: 'test@test.com', name: '' });
      expect(result.success).toBe(false);
    });

    it('rejects invalid role', () => {
      const result = createUserSchema.safeParse({
        email: 'test@test.com',
        name: 'Test',
        role: 'superadmin',
      });
      expect(result.success).toBe(false);
    });

    it("defaults role to 'developer'", () => {
      const result = createUserSchema.parse({ email: 'test@test.com', name: 'Test' });
      expect(result.role).toBe('developer');
    });
  });

  describe('updateUserSchema', () => {
    it('accepts partial update', () => {
      const result = updateUserSchema.safeParse({ name: 'New Name' });
      expect(result.success).toBe(true);
    });

    it('accepts empty object', () => {
      const result = updateUserSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });
});

describe('Application schemas', () => {
  const validApp = {
    name: 'my-app',
    templateId: uuid(),
    teamId: uuid(),
    ownerId: uuid(),
  };

  it('accepts valid input', () => {
    expect(createApplicationSchema.safeParse(validApp).success).toBe(true);
  });

  it('accepts valid input with optional fields', () => {
    const result = createApplicationSchema.safeParse({
      ...validApp,
      description: 'My app',
      repositoryUrl: 'https://github.com/example/repo',
    });
    expect(result.success).toBe(true);
  });

  it('rejects name longer than 100 chars', () => {
    const result = createApplicationSchema.safeParse({ ...validApp, name: 'x'.repeat(101) });
    expect(result.success).toBe(false);
  });

  it('rejects invalid UUID for templateId', () => {
    const result = createApplicationSchema.safeParse({ ...validApp, templateId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid URL', () => {
    const result = createApplicationSchema.safeParse({
      ...validApp,
      repositoryUrl: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('update schema allows partial fields', () => {
    expect(updateApplicationSchema.safeParse({ name: 'new-name' }).success).toBe(true);
    expect(updateApplicationSchema.safeParse({ status: 'active' }).success).toBe(true);
    expect(updateApplicationSchema.safeParse({}).success).toBe(true);
  });

  it('update schema rejects invalid status', () => {
    expect(updateApplicationSchema.safeParse({ status: 'invalid' }).success).toBe(false);
  });
});

describe('Deployment schemas', () => {
  const validDeployment = {
    applicationId: uuid(),
    environmentId: uuid(),
    version: '1.0.0',
    commitSha: 'abc123def456',
  };

  it('creates valid deployment', () => {
    expect(createDeploymentSchema.safeParse(validDeployment).success).toBe(true);
  });

  it('defaults trigger to manual', () => {
    const result = createDeploymentSchema.parse(validDeployment);
    expect(result.trigger).toBe('manual');
  });

  it('accepts valid trigger values', () => {
    for (const trigger of ['manual', 'git_push', 'scheduled', 'rollback']) {
      expect(createDeploymentSchema.safeParse({ ...validDeployment, trigger }).success).toBe(true);
    }
  });

  it('rejects invalid trigger', () => {
    expect(
      createDeploymentSchema.safeParse({ ...validDeployment, trigger: 'invalid' }).success,
    ).toBe(false);
  });

  it('rejects empty version', () => {
    expect(createDeploymentSchema.safeParse({ ...validDeployment, version: '' }).success).toBe(
      false,
    );
  });

  it('rejects invalid UUID for applicationId', () => {
    expect(
      createDeploymentSchema.safeParse({ ...validDeployment, applicationId: 'bad' }).success,
    ).toBe(false);
  });

  describe('transitionStatusSchema', () => {
    it('accepts valid statuses', () => {
      for (const status of [
        'building',
        'deploying',
        'healthy',
        'failed',
        'rolled_back',
        'cancelled',
      ]) {
        expect(transitionStatusSchema.safeParse({ status }).success).toBe(true);
      }
    });

    it('rejects invalid status', () => {
      expect(transitionStatusSchema.safeParse({ status: 'invalid' }).success).toBe(false);
    });

    it("rejects 'pending' as a transition target", () => {
      expect(transitionStatusSchema.safeParse({ status: 'pending' }).success).toBe(false);
    });
  });

  describe('approveDeploymentSchema', () => {
    it('accepts valid UUID', () => {
      expect(approveDeploymentSchema.safeParse({ approvedById: uuid() }).success).toBe(true);
    });

    it('rejects non-UUID', () => {
      expect(approveDeploymentSchema.safeParse({ approvedById: 'not-uuid' }).success).toBe(false);
    });
  });

  describe('recordViolationsSchema', () => {
    it('accepts valid violations', () => {
      const result = recordViolationsSchema.safeParse({
        violations: [
          {
            policyId: 'p1',
            policyName: 'Test Policy',
            severity: 'high',
            message: 'Violation detected',
            resource: 'Pod/default/my-pod',
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid severity', () => {
      const result = recordViolationsSchema.safeParse({
        violations: [
          {
            policyId: 'p1',
            policyName: 'Test',
            severity: 'unknown',
            message: 'test',
            resource: 'test',
          },
        ],
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('Team schema', () => {
  it('accepts valid team', () => {
    expect(createTeamSchema.safeParse({ name: 'platform', namespacePrefix: 'plat' }).success).toBe(
      true,
    );
  });

  it('accepts optional fields', () => {
    expect(
      createTeamSchema.safeParse({
        name: 'platform',
        description: 'Platform team',
        namespacePrefix: 'plat',
      }).success,
    ).toBe(true);
  });

  it('rejects empty name', () => {
    expect(createTeamSchema.safeParse({ name: '', namespacePrefix: 'x' }).success).toBe(false);
  });
});

describe('Template schema', () => {
  it('accepts valid template', () => {
    expect(
      createTemplateSchema.safeParse({
        name: 'nodejs-backend',
        category: 'backend',
        description: 'Node.js backend',
        repository: 'https://github.com/example',
      }).success,
    ).toBe(true);
  });

  it('rejects invalid category', () => {
    expect(
      createTemplateSchema.safeParse({
        name: 'test',
        category: 'invalid',
        description: 'test',
        repository: 'https://github.com/example',
      }).success,
    ).toBe(false);
  });
});

describe('Environment schema', () => {
  it('accepts valid environment', () => {
    expect(
      createEnvironmentSchema.safeParse({
        name: 'dev',
        type: 'dev',
        applicationId: uuid(),
        namespace: 'my-app-dev',
        clusterName: 'kubernal',
      }).success,
    ).toBe(true);
  });

  it('rejects invalid type', () => {
    expect(
      createEnvironmentSchema.safeParse({
        name: 'dev',
        type: 'production',
        applicationId: uuid(),
        namespace: 'test',
      }).success,
    ).toBe(false);
  });
});

describe('Pipeline schema', () => {
  it('accepts valid pipeline', () => {
    expect(
      createPipelineSchema.safeParse({
        deploymentId: uuid(),
        name: 'build-and-test',
      }).success,
    ).toBe(true);
  });

  it('rejects empty name', () => {
    expect(createPipelineSchema.safeParse({ deploymentId: uuid(), name: '' }).success).toBe(false);
  });
});

describe('Policy schema', () => {
  it('accepts valid policy', () => {
    expect(
      createPolicySchema.safeParse({
        name: 'no-privileged-containers',
        description: 'Prevent privileged containers',
        category: 'security',
        severity: 'critical',
        engine: 'kyverno',
      }).success,
    ).toBe(true);
  });

  it('rejects invalid category', () => {
    expect(
      createPolicySchema.safeParse({
        name: 'test',
        description: 'test',
        category: 'invalid',
        severity: 'high',
        engine: 'kyverno',
      }).success,
    ).toBe(false);
  });
});
