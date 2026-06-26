import 'dotenv/config';
import bcrypt from 'bcrypt';
import { createPrismaClient } from '../apps/api/src/shared/database.js';

const db = createPrismaClient(process.env['DATABASE_URL'] ?? '');

async function main(): Promise<void> {
  const email = process.env['ADMIN_EMAIL'];
  const password = process.env['ADMIN_PASSWORD'];
  const name = process.env['ADMIN_NAME'] ?? 'Platform Admin';

  if (!email || !password) {
    console.error('ERROR: ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required');
    console.error('Usage: ADMIN_EMAIL=admin@kubernal.io ADMIN_PASSWORD=... npm run seed:admin');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await db.user.upsert({
    where: { email },
    update: {
      name,
      role: 'admin',
      passwordHash,
    },
    create: {
      email,
      name,
      role: 'admin',
      passwordHash,
    },
  });

  console.log(`\n✅ Admin user created/updated:`);
  console.log(`   Email:    ${user.email}`);
  console.log(`   Name:     ${user.name}`);
  console.log(`   Role:     ${user.role}`);
  console.log(`   ID:       ${user.id}`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });