import { createPrismaClient } from '../src/shared/database.js';

const db = createPrismaClient(process.env['DATABASE_URL'] ?? '');

async function main() {
  console.log('Seeding database...\n');

  // ─── Teams ──────────────────────────────────────────────────────────────
  const teams = {
    platform: await db.team.upsert({
      where: { name: 'platform-team' },
      update: {},
      create: {
        name: 'platform-team',
        description: 'Platform engineering team managing the IDP',
        namespacePrefix: 'platform',
        quotaCpu: '8',
        quotaMemory: '16Gi',
      },
    }),
    rocket: await db.team.upsert({
      where: { name: 'squad-rocket' },
      update: {},
      create: {
        name: 'squad-rocket',
        description: 'Squad Rocket – consumer-facing applications',
        namespacePrefix: 'rocket',
        quotaCpu: '6',
        quotaMemory: '12Gi',
      },
    }),
    photon: await db.team.upsert({
      where: { name: 'squad-photon' },
      update: {},
      create: {
        name: 'squad-photon',
        description: 'Squad Photon – internal tools & infrastructure',
        namespacePrefix: 'photon',
        quotaCpu: '4',
        quotaMemory: '8Gi',
      },
    }),
  };
  console.log('✓ Teams:', Object.values(teams).map(t => t.name).join(', '));

  // ─── Users ───────────────────────────────────────────────────────────────
  const users = {
    admin: await db.user.upsert({
      where: { email: 'admin@kubernal.io' },
      update: {},
      create: {
        email: 'admin@kubernal.io', name: 'Platform Admin', role: 'platform_engineer',
        teamId: teams.platform.id,
      },
    }),
    alice: await db.user.upsert({
      where: { email: 'alice@kubernal.io' },
      update: {},
      create: {
        email: 'alice@kubernal.io', name: 'Alice Martin', role: 'developer',
        teamId: teams.rocket.id,
      },
    }),
    bob: await db.user.upsert({
      where: { email: 'bob@kubernal.io' },
      update: {},
      create: {
        email: 'bob@kubernal.io', name: 'Bob Dubois', role: 'developer',
        teamId: teams.rocket.id,
      },
    }),
    carole: await db.user.upsert({
      where: { email: 'carole@kubernal.io' },
      update: {},
      create: {
        email: 'carole@kubernal.io', name: 'Carole Petit', role: 'developer',
        teamId: teams.photon.id,
      },
    }),
    david: await db.user.upsert({
      where: { email: 'david@kubernal.io' },
      update: {},
      create: {
        email: 'david@kubernal.io', name: 'David Bernard', role: 'developer',
        teamId: teams.photon.id,
      },
    }),
    security: await db.user.upsert({
      where: { email: 'security@kubernal.io' },
      update: {},
      create: {
        email: 'security@kubernal.io', name: 'Sarah O\'Connor', role: 'security_admin',
        teamId: teams.platform.id,
      },
    }),
  };
  console.log('✓ Users:', Object.values(users).map(u => u.email).join(', '));

  // ─── Templates ───────────────────────────────────────────────────────────
  const templates = {
    nodejs: await db.goldenPathTemplate.upsert({
      where: { name: 'nodejs-backend' },
      update: {},
      create: {
        name: 'nodejs-backend', version: '1.0.0', category: 'backend',
        description: 'Node.js + Express backend service with PostgreSQL, Prisma, and OpenTelemetry',
        repository: 'https://github.com/Gowaru/template-nodejs-backend',
        parameters: { serviceName: { type: 'string', description: 'Service name' }, port: { type: 'number', description: 'HTTP port', default: 3000 } },
        steps: [{ id: 'clone', name: 'Clone repository', action: 'fetch:template', input: {} }, { id: 'provision', name: 'Provision environment', action: 'provision:infrastructure', input: {} }],
      },
    }),
    react: await db.goldenPathTemplate.upsert({
      where: { name: 'react-frontend' },
      update: {},
      create: {
        name: 'react-frontend', version: '2.0.0', category: 'frontend',
        description: 'React + TypeScript frontend with Vite, Tailwind CSS, and shadcn/ui',
        repository: 'https://github.com/Gowaru/template-react-frontend',
        parameters: { appName: { type: 'string', description: 'Application name' } },
        steps: [{ id: 'clone', name: 'Clone repository', action: 'fetch:template', input: {} }, { id: 'install', name: 'Install dependencies', action: 'run:script', input: { command: 'npm install' } }],
      },
    }),
    go: await db.goldenPathTemplate.upsert({
      where: { name: 'go-service' },
      update: {},
      create: {
        name: 'go-service', version: '1.2.0', category: 'backend',
        description: 'Go microservice with chi router, pgx, Prometheus metrics, and health checks',
        repository: 'https://github.com/Gowaru/template-go-service',
        parameters: { moduleName: { type: 'string', description: 'Go module name' }, port: { type: 'number', default: 8080 } },
        steps: [{ id: 'clone', name: 'Clone repository', action: 'fetch:template', input: {} }, { id: 'build', name: 'Build binary', action: 'run:script', input: { command: 'go build' } }],
      },
    }),
    fullstack: await db.goldenPathTemplate.upsert({
      where: { name: 'nextjs-fullstack' },
      update: {},
      create: {
        name: 'nextjs-fullstack', version: '1.0.0', category: 'fullstack',
        description: 'Next.js fullstack application with API routes, Prisma ORM, and PostgreSQL',
        repository: 'https://github.com/Gowaru/template-nextjs-fullstack',
        parameters: { appName: { type: 'string' } },
        steps: [{ id: 'clone', name: 'Clone repository', action: 'fetch:template', input: {} }, { id: 'setup-db', name: 'Setup database', action: 'run:script', input: { command: 'npx prisma migrate dev' } }],
      },
    }),
    python: await db.goldenPathTemplate.upsert({
      where: { name: 'python-function' },
      update: {},
      create: {
        name: 'python-function', version: '1.0.0', category: 'function',
        description: 'Python serverless function with FastAPI, Pydantic, and structured logging',
        repository: 'https://github.com/Gowaru/template-python-function',
        parameters: { functionName: { type: 'string' } },
        steps: [{ id: 'clone', name: 'Clone repository', action: 'fetch:template', input: {} }],
      },
    }),
  };
  console.log('✓ Templates:', Object.values(templates).map(t => t.name).join(', '));

  // ─── Clean derived data ─────────────────────────────────────────────────
  await db.pipeline.deleteMany();
  await db.deployment.deleteMany();
  await db.environment.deleteMany();
  await db.application.deleteMany();
  await db.observabilityConfig.deleteMany();

  // ─── Applications ────────────────────────────────────────────────────────
  const now = new Date();
  const apps = await Promise.all([
    db.application.create({
      data: {
        name: 'payment-api', description: 'Payment processing service', status: 'active',
        templateId: templates.nodejs.id, teamId: teams.rocket.id, ownerId: users.alice.id,
        repositoryUrl: 'https://github.com/Gowaru/payment-api',
        createdAt: new Date(now.getTime() - 90 * 86400000),
      },
    }),
    db.application.create({
      data: {
        name: 'user-service', description: 'User management and authentication', status: 'active',
        templateId: templates.go.id, teamId: teams.rocket.id, ownerId: users.bob.id,
        repositoryUrl: 'https://github.com/Gowaru/user-service',
        createdAt: new Date(now.getTime() - 80 * 86400000),
      },
    }),
    db.application.create({
      data: {
        name: 'customer-portal', description: 'Customer-facing web portal', status: 'active',
        templateId: templates.react.id, teamId: teams.rocket.id, ownerId: users.alice.id,
        repositoryUrl: 'https://github.com/Gowaru/customer-portal',
        createdAt: new Date(now.getTime() - 70 * 86400000),
      },
    }),
    db.application.create({
      data: {
        name: 'scheduler-service', description: 'Distributed job scheduler', status: 'active',
        templateId: templates.go.id, teamId: teams.photon.id, ownerId: users.carole.id,
        repositoryUrl: 'https://github.com/Gowaru/scheduler-service',
        createdAt: new Date(now.getTime() - 60 * 86400000),
      },
    }),
    db.application.create({
      data: {
        name: 'internal-dashboard', description: 'Internal admin dashboard', status: 'active',
        templateId: templates.fullstack.id, teamId: teams.photon.id, ownerId: users.david.id,
        repositoryUrl: 'https://github.com/Gowaru/internal-dashboard',
        createdAt: new Date(now.getTime() - 50 * 86400000),
      },
    }),
    db.application.create({
      data: {
        name: 'audit-logger', description: 'Audit log ingestion and query service', status: 'active',
        templateId: templates.python.id, teamId: teams.photon.id, ownerId: users.carole.id,
        repositoryUrl: 'https://github.com/Gowaru/audit-logger',
        createdAt: new Date(now.getTime() - 40 * 86400000),
      },
    }),
    db.application.create({
      data: {
        name: 'idp-console', description: 'Kubernal IDP web console (legacy)', status: 'active',
        templateId: templates.react.id, teamId: teams.platform.id, ownerId: users.admin.id,
        repositoryUrl: 'https://github.com/Gowaru/idp-console',
        createdAt: new Date(now.getTime() - 100 * 86400000),
      },
    }),
    db.application.create({
      data: {
        name: 'notification-service', description: 'Multi-channel notification dispatch', status: 'creating',
        templateId: templates.nodejs.id, teamId: teams.rocket.id, ownerId: users.bob.id,
        repositoryUrl: null,
        createdAt: new Date(now.getTime() - 2 * 86400000),
      },
    }),
  ]);
  console.log(`✓ Applications: ${apps.length} created`);

  // ─── Environments ────────────────────────────────────────────────────────
  const envs: Awaited<typeof db.environment.create>[] = [];
  for (const app of apps) {
    const prefix = app.name.replace(/-/g, '');
    const envData = [
      { name: `${app.name}-dev`, type: 'dev', requiresApproval: false, namespace: `${prefix}-dev` },
      { name: `${app.name}-staging`, type: 'staging', requiresApproval: true, namespace: `${prefix}-staging` },
      { name: `${app.name}-prod`, type: 'prod', requiresApproval: true, namespace: `${prefix}-prod` },
    ];
    for (const e of envData) {
      envs.push(await db.environment.create({
        data: { ...e, applicationId: app.id, clusterName: 'kubernal' },
      }));
    }
  }
  console.log(`✓ Environments: ${envs.length} created`);

  // ─── Deployments ─────────────────────────────────────────────────────────
  const statuses = ['pending', 'building', 'deploying', 'healthy', 'failed', 'rolled_back', 'cancelled'] as const;
  const triggers = ['manual', 'git_push', 'scheduled', 'rollback'] as const;
  const versions = ['1.0.0', '1.1.0', '1.2.0', '2.0.0', '2.1.0', '3.0.0', '1.0.1', '1.0.2', '1.1.1', '2.0.1'];

  const deploys: Awaited<typeof db.deployment.create>[] = [];
  const violations = [
    { policyId: '', policyName: 'no-privileged-containers', severity: 'critical', message: 'Container securityContext.privileged must be false', resource: 'Deployment/payment-api' },
    { policyId: '', policyName: 'read-only-rootfs', severity: 'high', message: 'Root filesystem should be read-only', resource: 'Deployment/user-service' },
    { policyId: '', policyName: 'resource-limits', severity: 'medium', message: 'Container resource limits are required', resource: 'Deployment/customer-portal' },
    { policyId: '', policyName: 'no-latest-tag', severity: 'high', message: 'Container image tag must not be "latest"', resource: 'Deployment/scheduler-service' },
  ];

  for (let i = 0; i < 35; i++) {
    const app = apps[i % apps.length];
    const appEnvs = envs.filter(e => e.applicationId === app.id);
    const env = appEnvs[i % appEnvs.length];
    const version = versions[i % versions.length];
    const status = i < 28 ? (i < 20 ? 'healthy' : statuses[i % statuses.length]) : 'healthy';
    const trigger = triggers[i % triggers.length];
    const startedAt = new Date(now.getTime() - (35 - i) * 86400000);
    const completedAt = ['healthy', 'failed', 'rolled_back', 'cancelled'].includes(status) ? new Date(startedAt.getTime() + 300000) : null;
    const hasViolations = i === 5 || i === 12 || i === 18 || i === 25;

    deploys.push(await db.deployment.create({
      data: {
        applicationId: app.id,
        environmentId: env.id,
        version,
        commitSha: `a1b2c${i.toString(16).padStart(3, '0')}`,
        status,
        trigger,
        approvedById: env.requiresApproval && (status === 'healthy' || status === 'deploying') ? users.admin.id : null,
        startedAt,
        completedAt,
        artifacts: status === 'healthy' ? [
          { name: `app-${version}.tar.gz`, size: `${(Math.random() * 50 + 10).toFixed(0)}MB` },
          { name: `Dockerfile`, size: '2KB' },
        ] : [],
        policyViolations: hasViolations ? violations.slice(0, (i % 3) + 1) : [],
      },
    }));
  }
  console.log(`✓ Deployments: ${deploys.length} created`);

  // ─── Pipelines ───────────────────────────────────────────────────────────
  const pipelineNames = ['Build & Test', 'Container Scan', 'Deploy to K8s', 'Health Check', 'Smoke Tests'];
  let pipelineCount = 0;
  for (const dep of deploys) {
    const numPipelines = dep.status === 'cancelled' ? 0 : dep.status === 'pending' ? 0 : dep.status === 'building' ? 1 : Math.min(3, pipelineNames.length);
    for (let j = 0; j < numPipelines; j++) {
      const isTerminal = dep.completedAt != null;
      await db.pipeline.create({
        data: {
          deploymentId: dep.id,
          name: pipelineNames[j % pipelineNames.length],
          status: isTerminal ? 'success' : j < 1 ? 'running' : 'running',
          stages: isTerminal ? [
            { id: 'checkout', name: 'Checkout', status: 'success', durationMs: 15000 },
            { id: 'install', name: 'Install dependencies', status: 'success', durationMs: 45000 },
            { id: 'test', name: 'Run tests', status: 'success', durationMs: 30000 },
            { id: 'build', name: 'Build image', status: 'success', durationMs: 120000 },
          ] : j === 0 ? [
            { id: 'checkout', name: 'Checkout', status: 'success', durationMs: 12000 },
            { id: 'install', name: 'Install dependencies', status: 'running', durationMs: null },
            { id: 'test', name: 'Run tests', status: 'pending', durationMs: null },
          ] : [],
          logsUrl: isTerminal ? `https://logs.kubernal.io/pipeline/${dep.id}/run-${j}` : null,
          startedAt: dep.startedAt,
          completedAt: isTerminal ? dep.completedAt : null,
        },
      });
      pipelineCount++;
    }
  }
  console.log(`✓ Pipelines: ${pipelineCount} created`);

  // ─── Security Policies ──────────────────────────────────────────────────
  const policies = [
    { name: 'no-privileged-containers', description: 'Prevents deployment of privileged containers in production', category: 'security', severity: 'critical', engine: 'kyverno', enabled: true },
    { name: 'read-only-rootfs', description: 'Requires read-only root filesystem for containers', category: 'security', severity: 'high', engine: 'kyverno', enabled: true },
    { name: 'resource-limits', description: 'All containers must define CPU and memory resource limits', category: 'compliance', severity: 'medium', engine: 'opa', enabled: true },
    { name: 'no-latest-tag', description: 'Container images must not use the "latest" tag', category: 'operations', severity: 'high', engine: 'custom', enabled: true },
    { name: 'cost-aware-deployments', description: 'Production deployments must have cost allocation tags', category: 'cost', severity: 'low', engine: 'opa', enabled: false },
    { name: 'network-policy-enforced', description: 'All namespaces must have a default deny NetworkPolicy', category: 'compliance', severity: 'critical', engine: 'kyverno', enabled: true },
  ];

  for (const policy of policies) {
    await db.securityPolicy.upsert({
      where: { name: policy.name },
      update: { enabled: policy.enabled, severity: policy.severity },
      create: {
        ...policy,
        rules: { match: { kind: 'Pod' }, validate: { message: policy.description, pattern: {} } },
      },
    });
  }
  console.log(`✓ Policies: ${policies.length} synced`);

  // ─── Observability Config ────────────────────────────────────────────────
  for (const app of apps) {
    const team = [teams.rocket, teams.photon, teams.platform].find(t => t.id === app.teamId);
    await db.observabilityConfig.create({
      data: {
        applicationId: app.id,
        teamId: app.teamId,
        dashboardUrl: `https://grafana.kubernal.io/d/${app.name}`,
        alertsEnabled: true,
        logRetentionDays: team?.name === 'platform-team' ? 90 : 30,
        tracingSampleRate: 0.1,
      },
    });
  }
  console.log(`✓ Observability config: ${apps.length} created`);

  console.log('\n✅ Seeding complete.');
}

main()
  .catch((e) => { console.error('Seed failed:', e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
