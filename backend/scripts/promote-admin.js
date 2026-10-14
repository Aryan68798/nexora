import { prisma } from '../src/lib/prisma.js';

async function promoteAdmin() {
  const email = process.argv[2]?.trim().toLowerCase();

  if (!email) {
    console.error('Usage: npm run admin:promote -- <user@email.com>');
    process.exit(1);
  }

  const profile = await prisma.profiles.findUnique({
    where: { email },
  });

  if (!profile) {
    console.error(`Error: No profile found with email "${email}". User must exist in the database first.`);
    process.exit(1);
  }

  const oldRole = profile.role;

  if (oldRole === 'ADMIN') {
    console.log(`User "${email}" is already an ADMIN.`);
    process.exit(0);
  }

  const updated = await prisma.profiles.update({
    where: { email },
    data: { role: 'ADMIN' },
  });

  console.log(`Success: Promoted user to ADMIN.`);
  console.log(`  Email:    ${updated.email}`);
  console.log(`  Old Role: ${oldRole}`);
  console.log(`  New Role: ${updated.role}`);
}

promoteAdmin()
  .catch((err) => {
    console.error('Promotion failed:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
