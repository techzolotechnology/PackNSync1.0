import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_ADMIN_NAME = 'PickAndSync Admin';
const DEFAULT_ADMIN_CITY = 'Bangalore';

function getTrimmedEnv(name) {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

async function main() {
  const adminEmailRaw = process.env.ADMIN_EMAIL;
  if (typeof adminEmailRaw !== 'string' || !adminEmailRaw.trim()) {
    throw new Error('Missing required environment variable ADMIN_EMAIL');
  }

  const email = adminEmailRaw.trim().toLowerCase();

  const adminNameFromEnv = getTrimmedEnv('ADMIN_NAME');
  const adminCityFromEnv = getTrimmedEnv('ADMIN_CITY');
  const adminName = adminNameFromEnv || DEFAULT_ADMIN_NAME;
  const adminCity = adminCityFromEnv || DEFAULT_ADMIN_CITY;

  // Only update name/city if caller actually provided non-empty values.
  const shouldUpdateName = Boolean(adminNameFromEnv);
  const shouldUpdateCity = Boolean(adminCityFromEnv);

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true },
  });

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      name: adminName,
      email,
      role: 'ADMIN',
      city: adminCity,
      bio: 'PickAndSync admin account. Platform access enabled.',
      languages: ['English', 'Hindi'],
      interests: ['Road trips', 'City breaks'],
      travelStyle: 'balanced',
    },
    update: {
      role: 'ADMIN',
      ...(shouldUpdateName ? { name: adminName } : {}),
      ...(shouldUpdateCity ? { city: adminCity } : {}),
    },
    select: { id: true, email: true, role: true },
  });

  const action = existing ? 'updated' : 'created';
  console.log(`Admin user ${action} successfully.`);
  console.log(`id=${user.id}`);
  console.log(`email=${user.email}`);
  console.log(`role=${user.role}`);
}

main()
  .catch((err) => {
    console.error('Admin upsert failed:', err?.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });

