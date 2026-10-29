import dotenv from 'dotenv';
import { supabaseAdmin } from '../src/lib/supabaseAdmin.js';
import { prisma } from '../src/lib/prisma.js';

dotenv.config();

const AUDIT_BUCKETS = [
  'property-media',
  'space-media',
  'inspection-media',
  'maintenance-media',
  'receipts',
  'Avatars',
];

/**
 * Recursively lists all file object paths inside a Supabase Storage bucket.
 * @param {string} bucket - Bucket name
 * @param {string} [prefix=''] - Folder prefix
 * @returns {Promise<string[]>}
 */
async function listAllObjectsInBucket(bucket, prefix = '') {
  const objects = [];
  const { data, error } = await supabaseAdmin.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error || !data) return objects;

  for (const item of data) {
    // Skip placeholder or hidden files if any
    if (item.name === '.emptyFolderPlaceholder') continue;
    const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
    // In Supabase Storage, folders either have no id, or metadata is null / placeholder
    if (!item.id && (!item.metadata || Object.keys(item.metadata).length === 0)) {
      const nested = await listAllObjectsInBucket(bucket, itemPath);
      objects.push(...nested);
    } else {
      objects.push(itemPath);
    }
  }

  return objects;
}

async function runStorageAudit() {
  if (!supabaseAdmin) {
    console.error('Error: SUPABASE_SERVICE_ROLE_KEY is not configured in .env');
    process.exit(1);
  }

  console.log('=== Nexora Storage Audit (Read-Only) ===\n');

  let totalOrphanFiles = 0;
  let totalMissingFiles = 0;

  for (const bucket of AUDIT_BUCKETS) {
    console.log(`Auditing bucket: "${bucket}"...`);

    // 1. List all actual storage objects
    const storagePaths = await listAllObjectsInBucket(bucket);
    const storagePathSet = new Set(storagePaths);

    // 2. Fetch all media_assets recorded in DB for this bucket
    const dbAssets = await prisma.media_assets.findMany({
      where: { bucket },
      select: { storage_path: true, id: true },
    });
    const dbPathSet = new Set(dbAssets.map((a) => a.storage_path));

    // 3. Storage objects that have NO matching media_assets row (orphans)
    const orphanStorageFiles = storagePaths.filter((path) => !dbPathSet.has(path));

    // 4. media_assets rows whose storage object is missing from bucket
    const missingStorageFiles = dbAssets
      .filter((a) => !storagePathSet.has(a.storage_path))
      .map((a) => a.storage_path);

    console.log(`  Actual storage objects:       ${storagePaths.length}`);
    console.log(`  Database media_assets rows:   ${dbAssets.length}`);
    if (bucket === 'inspection-media' || bucket === 'maintenance-media') {
      const topLevelFolders = Array.from(new Set(storagePaths.map((p) => p.split('/')[0]))).filter(Boolean);
      console.log(`  First-level folders:          ${topLevelFolders.join(', ') || '(none)'}`);
    }
    console.log(`  Orphan storage objects:       ${orphanStorageFiles.length}`);
    if (orphanStorageFiles.length > 0) {
      orphanStorageFiles.forEach((p) => console.log(`    - [Orphan Storage Object] ${p}`));
    }
    console.log(`  Missing storage objects in DB: ${missingStorageFiles.length}`);
    if (missingStorageFiles.length > 0) {
      missingStorageFiles.forEach((p) => console.log(`    - [Missing from Storage] ${p}`));
    }
    console.log('');

    totalOrphanFiles += orphanStorageFiles.length;
    totalMissingFiles += missingStorageFiles.length;
  }

  console.log('=== Storage Audit Summary ===');
  console.log(`Total orphan storage objects (untracked by media_assets): ${totalOrphanFiles}`);
  console.log(`Total media_assets rows with missing storage file:       ${totalMissingFiles}`);
  console.log('Read-only audit completed. No records or files were altered.');
}

runStorageAudit()
  .catch((err) => {
    console.error('Audit failed:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
