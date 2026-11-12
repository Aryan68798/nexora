import dotenv from 'dotenv';
import { supabaseAdmin } from '../src/lib/supabaseAdmin.js';

dotenv.config();

const REQUIRED_BUCKETS = [
  'property-media',
  'space-media',
  'Avatars',
  'inspection-media',
  'maintenance-media',
  'receipts',
];

async function checkStorage() {
  if (!supabaseAdmin) {
    console.error('Error: SUPABASE_SERVICE_ROLE_KEY is not configured.');
    process.exit(1);
  }

  const { data: buckets, error } = await supabaseAdmin.storage.listBuckets();
  if (error) {
    console.error('Failed to list storage buckets:', error.message);
    process.exit(1);
  }

  console.log('=== Supabase Storage Buckets ===');
  const existingNames = new Set();

  for (const b of buckets || []) {
    console.log(`  Bucket: ${b.name} (public: ${b.public})`);
    existingNames.add(b.name);
  }

  console.log('\n=== Required Bucket Verification ===');
  let allPresent = true;
  for (const req of REQUIRED_BUCKETS) {
    const present = existingNames.has(req);
    console.log(`  ${present ? '✔' : '✖'} ${req}: ${present ? 'PRESENT' : 'MISSING'}`);
    if (!present) allPresent = false;
  }

  if (!allPresent) {
    console.error('\nError: Some required buckets are missing in Supabase Storage.');
    process.exit(1);
  }

  console.log('\nAll required storage buckets verified successfully.');
}

checkStorage().catch((err) => {
  console.error('Storage check failed:', err.message);
  process.exit(1);
});
