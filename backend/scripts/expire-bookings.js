import { expireStaleBookings } from '../src/services/booking.service.js';
import { prisma } from '../src/lib/prisma.js';

async function main() {
  console.log('Checking and expiring stale PENDING bookings...');
  const expiredCount = await expireStaleBookings();
  console.log(`Successfully expired ${expiredCount} stale booking(s).`);
}

main()
  .catch((err) => {
    console.error('Error expiring bookings:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
