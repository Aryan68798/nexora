import { Prisma } from '@prisma/client';
import { prisma } from '../src/lib/prisma.js';

const DEMO_PROPERTIES = [
  {
    title: 'Horizon Tech Center',
    description: 'Premier grade-A tech workspace in the heart of Koramangala with 24/7 power backup, high-speed fiber internet, and ergonomic workstations.',
    propertyType: 'COMMERCIAL',
    addressLine1: '80 Feet Road, 4th Block, Koramangala',
    addressLine2: 'Wing B, Levels 3-4',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560034',
    country: 'India',
    latitude: new Prisma.Decimal('12.9352420'),
    longitude: new Prisma.Decimal('77.6244610'),
    spaces: [
      {
        name: 'Quantum Boardroom',
        description: 'Sound-insulated executive boardroom with 4K video conferencing, motorized blackout blinds, and seating for 16.',
        spaceType: 'OFFICE',
        capacity: 16,
        priceAmount: new Prisma.Decimal('1200.00'),
        priceUnit: 'HOUR',
        rules: 'No outside catering inside the boardroom. Wipe whiteboard clean before leaving.',
      },
      {
        name: 'Silicon Flex Workstation',
        description: 'Dedicated ergonomic sit-stand desk in a calm, productivity-focused shared floor with dual monitor arms.',
        spaceType: 'OFFICE',
        capacity: 1,
        priceAmount: new Prisma.Decimal('500.00'),
        priceUnit: 'DAY',
        rules: 'Maintain quiet zone etiquette. Phone calls must be taken in dedicated phone booths.',
      },
      {
        name: 'Developer Collaboration Lab',
        description: 'Dynamic workshop room with modular roll-away tables, multiple writable glassboards, and ceiling-mounted projectors.',
        spaceType: 'CLASSROOM',
        capacity: 24,
        priceAmount: new Prisma.Decimal('1800.00'),
        priceUnit: 'HOUR',
        rules: 'Network switches and patch cables must remain plugged into lab rack.',
      },
    ],
  },
  {
    title: 'Bandra Coastal Studios',
    description: 'Boutique media, audio, and visual production facility situated in West Bandra with acoustically engineered rooms and natural daylight.',
    propertyType: 'COMMERCIAL',
    addressLine1: 'Pali Hill Road, Bandra West',
    addressLine2: 'Suite 201',
    city: 'Mumbai',
    state: 'Maharashtra',
    postalCode: '400050',
    country: 'India',
    latitude: new Prisma.Decimal('19.0596000'),
    longitude: new Prisma.Decimal('72.8295000'),
    spaces: [
      {
        name: 'Sea Breeze Photography Studio',
        description: '1,200 sq ft photography bay with an 18-foot infinity cyclorama wall, Bowens lighting grid, and changing room.',
        spaceType: 'STUDIO',
        capacity: 10,
        priceAmount: new Prisma.Decimal('1500.00'),
        priceUnit: 'HOUR',
        rules: 'Strictly shoes off on the white cyclorama floor. Repainting fee applies if scuffed.',
      },
      {
        name: 'Acoustic Podcast Suite',
        description: 'Padded broadcast studio featuring 4 Shure SM7B microphones, Rodecaster Pro console, and soundproof double doors.',
        spaceType: 'STUDIO',
        capacity: 4,
        priceAmount: new Prisma.Decimal('800.00'),
        priceUnit: 'HOUR',
        rules: 'No open liquids near electronic mixing consoles.',
      },
      {
        name: 'Creative Workshop Hall',
        description: 'Sunlit open room ideal for design sprints, creative roundtables, art popups, and small team offsites.',
        spaceType: 'ROOM',
        capacity: 30,
        priceAmount: new Prisma.Decimal('6000.00'),
        priceUnit: 'DAY',
        rules: 'Furniture may be rearranged but must be restored to floor plan at checkout.',
      },
    ],
  },
  {
    title: 'Connaught Executive Hub',
    description: 'Prestigious corporate facility located in Delhi Inner Circle with historic colonial architecture and modern executive amenities.',
    propertyType: 'OFFICE_BUILDING',
    addressLine1: 'Barakhamba Road, Connaught Place',
    addressLine2: 'Tower A, 5th Floor',
    city: 'New Delhi',
    state: 'Delhi',
    postalCode: '110001',
    country: 'India',
    latitude: new Prisma.Decimal('28.6304000'),
    longitude: new Prisma.Decimal('77.2177000'),
    spaces: [
      {
        name: 'Viceroy Executive Office Suite',
        description: 'Private 6-person furnished office with private lounge, reception support, and secure keycard entry.',
        spaceType: 'OFFICE',
        capacity: 6,
        priceAmount: new Prisma.Decimal('2200.00'),
        priceUnit: 'DAY',
        rules: 'Access cards must be returned upon departure. Reserved parking on B2 level.',
      },
      {
        name: 'Diplomat Seminar Hall',
        description: 'Auditorium-style training hall with tiered seating, dual projection screens, and stage podium with wireless lavalier mics.',
        spaceType: 'CLASSROOM',
        capacity: 50,
        priceAmount: new Prisma.Decimal('3500.00'),
        priceUnit: 'HOUR',
        rules: 'A/V technician provided for first 15 minutes of event setup.',
      },
    ],
  },
];

async function seedDemo() {
  const email = process.argv[2]?.trim().toLowerCase();

  if (!email) {
    console.error('Usage: npm run seed:demo -- <owner@email.com>');
    process.exit(1);
  }

  const profile = await prisma.profiles.findUnique({
    where: { email },
  });

  if (!profile) {
    console.error(`Error: No profile found with email "${email}".`);
    process.exit(1);
  }

  if (profile.role !== 'OWNER' && profile.role !== 'ADMIN') {
    console.error(`Error: User "${email}" has role "${profile.role}". Requires role OWNER or ADMIN.`);
    process.exit(1);
  }

  console.log(`=== Seeding Demo Data for Owner: ${profile.email} (${profile.id}) ===\n`);

  let propertiesCreated = 0;
  let spacesCreated = 0;

  for (const propData of DEMO_PROPERTIES) {
    let property = await prisma.properties.findFirst({
      where: {
        owner_id: profile.id,
        title: propData.title,
      },
    });

    if (!property) {
      property = await prisma.properties.create({
        data: {
          owner_id: profile.id,
          title: propData.title,
          description: propData.description,
          property_type: propData.propertyType,
          address_line1: propData.addressLine1,
          address_line2: propData.addressLine2,
          city: propData.city,
          state: propData.state,
          postal_code: propData.postalCode,
          country: propData.country,
          latitude: propData.latitude,
          longitude: propData.longitude,
          status: 'ACTIVE',
        },
      });
      propertiesCreated++;
      console.log(`✔ Created Property: "${property.title}" in ${property.city}`);
    } else {
      console.log(`ℹ Property already exists (skipping): "${property.title}" in ${property.city}`);
    }

    for (const spaceData of propData.spaces) {
      const existingSpace = await prisma.spaces.findFirst({
        where: {
          property_id: property.id,
          name: spaceData.name,
        },
      });

      if (!existingSpace) {
        const createdSpace = await prisma.spaces.create({
          data: {
            property_id: property.id,
            name: spaceData.name,
            description: spaceData.description,
            space_type: spaceData.spaceType,
            capacity: spaceData.capacity,
            price_amount: spaceData.priceAmount,
            price_unit: spaceData.priceUnit,
            rules: spaceData.rules,
            status: 'AVAILABLE',
          },
        });
        spacesCreated++;
        console.log(`   + Created Space: "${createdSpace.name}" (${createdSpace.space_type}, ₹${createdSpace.price_amount}/${createdSpace.price_unit})`);
      } else {
        console.log(`   - Space already exists (skipping): "${existingSpace.name}"`);
      }
    }
  }

  console.log(`\nDemo seed complete. Added ${propertiesCreated} properties, ${spacesCreated} spaces.`);
}

seedDemo()
  .catch((err) => {
    console.error('Demo seed failed:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
