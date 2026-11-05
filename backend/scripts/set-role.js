import { prisma } from '../src/lib/prisma.js';

const ALLOWED_ROLES = ['OWNER', 'CUSTOMER', 'PROVIDER', 'ADMIN'];

async function setRole() {
  const email = process.argv[2]?.trim().toLowerCase();
  const rawRole = process.argv[3]?.trim().toUpperCase();

  if (!email || !rawRole) {
    console.error('Usage: npm run user:set-role -- <user@email.com> <ROLE>');
    console.error(`Allowed roles: ${ALLOWED_ROLES.join(', ')}`);
    process.exit(1);
  }

  if (!ALLOWED_ROLES.includes(rawRole)) {
    console.error(`Invalid role "${rawRole}". Allowed roles are: ${ALLOWED_ROLES.join(', ')}`);
    process.exit(1);
  }

  const role = rawRole;

  const profile = await prisma.profiles.findUnique({
    where: { email },
  });

  if (!profile) {
    console.error(`Error: No profile found with email "${email}". User must exist in the database first.`);
    process.exit(1);
  }

  const oldRole = profile.role;

  if (oldRole === role) {
    console.log(`User "${email}" already has role "${role}".`);
    process.exit(0);
  }

  const updated = await prisma.profiles.update({
    where: { email },
    data: { role },
  });

  console.log(`Success: Updated role for "${email}".`);
  console.log(`  Email:    ${updated.email}`);
  console.log(`  Old Role: ${oldRole}`);
  console.log(`  New Role: ${updated.role}`);
}

setRole()
  .catch((err) => {
    console.error('Set-role failed:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
