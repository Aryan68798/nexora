import { prisma } from '../src/lib/prisma.js';

const CATEGORIES = [
  { name: 'Plumbing', description: 'Plumbing installation, repair, pipe maintenance, and drainage services.' },
  { name: 'Electrical', description: 'Wiring, fixtures, electrical panels, and appliance connections.' },
  { name: 'Carpentry', description: 'Woodwork, furniture repair, door and window framing, and cabinetry.' },
  { name: 'Painting', description: 'Interior and exterior wall painting, touch-ups, and surface coatings.' },
  { name: 'Cleaning', description: 'Deep cleaning, regular housekeeping, move-out cleaning, and sanitization.' },
  { name: 'HVAC and Air Conditioning', description: 'Heating, ventilation, air conditioning installation, and servicing.' },
  { name: 'Pest Control', description: 'Inspection, fumigation, termite control, and pest prevention.' },
  { name: 'Appliance Repair', description: 'Diagnosis and repair of kitchen, laundry, and household appliances.' },
  { name: 'Security Systems', description: 'CCTV installation, smart locks, access control, and alarm monitoring.' },
  { name: 'Gardening', description: 'Lawn care, landscaping, pruning, plant maintenance, and garden clearing.' },
];

async function seed() {
  console.log('Seeding service categories (idempotent upsert)...');

  for (const cat of CATEGORIES) {
    const record = await prisma.service_categories.upsert({
      where: { name: cat.name },
      update: {
        description: cat.description,
        is_active: true,
      },
      create: {
        name: cat.name,
        description: cat.description,
        is_active: true,
      },
    });
    console.log(`  ✔ Category: ${record.name} (${record.id})`);
  }

  const total = await prisma.service_categories.count();
  console.log(`\nSeed completed successfully. Total service categories: ${total}`);
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
