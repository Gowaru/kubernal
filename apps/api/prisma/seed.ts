import { createPrismaClient } from "../src/shared/database.js";

const seedDb = createPrismaClient(process.env["DATABASE_URL"] ?? "");

async function main() {
  console.log("Seeding database...");

  const platformTeam = await seedDb.team.upsert({
    where: { name: "platform-team" },
    update: {},
    create: {
      name: "platform-team",
      description: "Platform engineering team managing the IDP",
      namespacePrefix: "platform",
      quotaCpu: "8",
      quotaMemory: "16Gi",
    },
  });

  const adminUser = await seedDb.user.upsert({
    where: { email: "admin@kubernal.io" },
    update: {},
    create: {
      email: "admin@kubernal.io",
      name: "Platform Admin",
      role: "platform_engineer",
      teamId: platformTeam.id,
    },
  });

  const backendTemplate = await seedDb.goldenPathTemplate.upsert({
    where: { name: "nodejs-backend" },
    update: {},
    create: {
      name: "nodejs-backend",
      version: "1.0.0",
      category: "backend",
      description: "Node.js + Express backend service with PostgreSQL, Prisma, and OpenTelemetry",
      repository: "https://github.com/<PLACEHOLDER_ORG>/template-nodejs-backend",
      parameters: {
        serviceName: { type: "string", description: "Service name" },
        port: { type: "number", description: "HTTP port", default: 3000 },
      },
      steps: [
        { id: "clone", name: "Clone repository", action: "fetch:template", input: { url: "{{ parameters.repo }}" } },
        { id: "provision", name: "Provision environment", action: "provision:infrastructure", input: {} },
      ],
    },
  });

  const defaultPolicy = await seedDb.securityPolicy.upsert({
    where: { name: "no-privileged-containers" },
    update: {},
    create: {
      name: "no-privileged-containers",
      description: "Prevents deployment of privileged containers in production",
      category: "security",
      severity: "critical",
      engine: "kyverno",
      enabled: true,
      rules: {
        match: { kind: "Pod" },
        validate: { message: "Privileged containers are not allowed", pattern: { spec: { containers: [{ securityContext: { privileged: false } }] } } },
      },
    },
  });

  console.log("✓ Team created:", platformTeam.name);
  console.log("✓ User created:", adminUser.email);
  console.log("✓ Template created:", backendTemplate.name);
  console.log("✓ Policy created:", defaultPolicy.name);
  console.log("Seeding complete.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await seedDb.$disconnect();
  });
