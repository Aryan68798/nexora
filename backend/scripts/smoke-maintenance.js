import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '../src/lib/prisma.js';
import { storageService } from '../src/services/storage.service.js';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const TEST_OWNER_EMAIL = process.env.TEST_OWNER_EMAIL;
const TEST_OWNER_PASSWORD = process.env.TEST_OWNER_PASSWORD;
const TEST_PROVIDER_EMAIL = process.env.TEST_PROVIDER_EMAIL;
const TEST_PROVIDER_PASSWORD = process.env.TEST_PROVIDER_PASSWORD;
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL;
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD;
const PORT = process.env.PORT || '8000';
const BASE_URL = `http://localhost:${PORT}`;

// 1x1 valid PNG buffer
const TINY_PNG_BUFFER = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082',
  'hex'
);

async function runSmokeMaintenance() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('FAIL: Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment');
    process.exit(1);
  }

  if (!TEST_OWNER_EMAIL || !TEST_OWNER_PASSWORD) {
    console.error('FAIL: Missing TEST_OWNER_EMAIL or TEST_OWNER_PASSWORD in .env');
    process.exit(1);
  }

  if (!TEST_PROVIDER_EMAIL || !TEST_PROVIDER_PASSWORD) {
    console.error('FAIL: Missing TEST_PROVIDER_EMAIL or TEST_PROVIDER_PASSWORD in .env');
    process.exit(1);
  }

  if (!TEST_USER_EMAIL || !TEST_USER_PASSWORD) {
    console.error('FAIL: Missing TEST_USER_EMAIL or TEST_USER_PASSWORD in .env');
    process.exit(1);
  }

  console.log(`=== Smoke Test: Service Providers & Maintenance Job Workflow against ${BASE_URL} ===\n`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Authenticate users
  console.log('1. Authenticating test users...');
  const [ownerAuth, providerAuth, userAuth] = await Promise.all([
    supabase.auth.signInWithPassword({ email: TEST_OWNER_EMAIL, password: TEST_OWNER_PASSWORD }),
    supabase.auth.signInWithPassword({ email: TEST_PROVIDER_EMAIL, password: TEST_PROVIDER_PASSWORD }),
    supabase.auth.signInWithPassword({ email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD }),
  ]);

  if (ownerAuth.error || !ownerAuth.data.session?.access_token) {
    console.error('FAIL: Owner sign in failed:', ownerAuth.error?.message);
    process.exit(1);
  }
  if (providerAuth.error || !providerAuth.data.session?.access_token) {
    console.error('FAIL: Provider sign in failed:', providerAuth.error?.message);
    process.exit(1);
  }
  if (userAuth.error || !userAuth.data.session?.access_token) {
    console.error('FAIL: Customer sign in failed:', userAuth.error?.message);
    process.exit(1);
  }

  const ownerToken = ownerAuth.data.session.access_token;
  const providerToken = providerAuth.data.session.access_token;
  const customerToken = userAuth.data.session.access_token;
  console.log('   ✔ PASS: Owner, Provider, and Customer authenticated');

  // Ensure test users have known phone numbers for live privacy verification
  const OWNER_PHONE = '+919876543210';
  const PROVIDER_PHONE = '+919123456780';
  await prisma.profiles.update({
    where: { email: TEST_OWNER_EMAIL },
    data: { phone: OWNER_PHONE },
  });
  await prisma.profiles.update({
    where: { email: TEST_PROVIDER_EMAIL },
    data: { phone: PROVIDER_PHONE },
  });

  // Track created resources for cleanup
  let propertyId = null;
  let requestId1 = null;
  let requestId2 = null;
  let providerId = null;
  const uploadedStoragePaths = [];

  try {
    // 2. Fetch service categories
    console.log('\n2. Fetching Service Category...');
    const cat = await prisma.service_categories.findFirst({
      where: { is_active: true },
    });
    if (!cat) {
      console.error('FAIL: No active service category found in database');
      process.exit(1);
    }
    const categoryId = cat.id;
    console.log(`   ✔ PASS: Using service category "${cat.name}" (id: ${categoryId})`);

    // 3. Provider profile creation / setup
    console.log('\n3. Checking / Creating Provider Profile (POST /api/providers/profile)...');
    const meRes = await fetch(`${BASE_URL}/api/providers/me`, {
      headers: { Authorization: `Bearer ${providerToken}` },
    });

    if (meRes.status === 404) {
      const createProfileRes = await fetch(`${BASE_URL}/api/providers/profile`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${providerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businessName: 'Apex Maintenance & Plumbing',
          bio: 'Expert commercial and residential facility maintenance and repairs',
          serviceAreaCity: 'Bengaluru',
          serviceAreaState: 'Karnataka',
          categoryIds: [categoryId],
        }),
      });
      const createJson = await createProfileRes.json();
      if (!createProfileRes.ok || !createJson.data?.id) {
        console.error('FAIL: Provider profile creation failed:', createJson);
        process.exit(1);
      }
      providerId = createJson.data.id;
      if (createJson.data.verificationStatus !== 'PENDING') {
        console.error('FAIL: New provider should start PENDING, got:', createJson.data.verificationStatus);
        process.exit(1);
      }
      console.log(`   ✔ PASS: Provider profile created with PENDING status (id: ${providerId})`);
    } else {
      const meJson = await meRes.json();
      providerId = meJson.data.id;
      // Reset to PENDING for the smoke test flow
      await prisma.service_providers.update({
        where: { id: providerId },
        data: { verification_status: 'PENDING' },
      });
      console.log(`   ✔ PASS: Existing provider profile loaded and reset to PENDING for smoke test (id: ${providerId})`);
    }

    // 4. Owner creates Property & Maintenance Request
    console.log('\n4. Owner creates Property and Maintenance Request (POST /api/maintenance-requests)...');
    const propRes = await fetch(`${BASE_URL}/api/properties`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Smoke Test Maintenance Property',
        propertyType: 'COMMERCIAL',
        addressLine1: '400 Industrial Boulevard',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560001',
        country: 'India',
      }),
    });
    const propJson = await propRes.json();
    if (!propRes.ok || !propJson.data?.id) {
      console.error('FAIL: Property creation failed:', propJson);
      process.exit(1);
    }
    propertyId = propJson.data.id;

    const reqRes1 = await fetch(`${BASE_URL}/api/maintenance-requests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        propertyId,
        categoryId,
        title: 'High-pressure water valve leakage',
        description: 'Main shutoff valve in basement utility room has severe drip.',
        priority: 'HIGH',
      }),
    });
    const reqJson1 = await reqRes1.json();
    if (!reqRes1.ok || !reqJson1.data?.id) {
      console.error('FAIL: Maintenance request creation failed:', reqJson1);
      process.exit(1);
    }
    requestId1 = reqJson1.data.id;
    console.log(`   ✔ PASS: Maintenance request created (id: ${requestId1}, status: ${reqJson1.data.status})`);

    // 5. Owner attempts to assign unverified provider -> expects 400 PROVIDER_NOT_VERIFIED
    console.log('\n5. Owner attempts to assign unverified provider (expects 400 PROVIDER_NOT_VERIFIED)...');
    const assignUnverifiedRes = await fetch(`${BASE_URL}/api/maintenance-requests/${requestId1}/assign`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ providerId }),
    });
    const assignUnverifiedJson = await assignUnverifiedRes.json();
    if (assignUnverifiedRes.status !== 400 || assignUnverifiedJson.error?.code !== 'PROVIDER_NOT_VERIFIED') {
      console.error('FAIL: Expected 400 PROVIDER_NOT_VERIFIED, got:', assignUnverifiedRes.status, assignUnverifiedJson);
      process.exit(1);
    }
    console.log('   ✔ PASS: Rejected assignment of unverified provider with 400 PROVIDER_NOT_VERIFIED');

    // 6. Verify provider
    console.log('\n6. Verifying provider...');
    await prisma.service_providers.update({
      where: { id: providerId },
      data: { verification_status: 'VERIFIED' },
    });
    console.log('   [smoke] provider verified directly in DB (no admin token)');
    console.log('   ✔ PASS: Provider verification status updated to VERIFIED');

    // 7. Concurrency test: Two assign calls at the same instant (Promise.all)
    console.log('\n7. Concurrency Test: Firing TWO simultaneous assign calls (Promise.all)...');
    const [concurrent1, concurrent2] = await Promise.all([
      fetch(`${BASE_URL}/api/maintenance-requests/${requestId1}/assign`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ownerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ providerId }),
      }),
      fetch(`${BASE_URL}/api/maintenance-requests/${requestId1}/assign`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ownerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ providerId }),
      }),
    ]);

    const statuses = [concurrent1.status, concurrent2.status].sort();
    if (statuses[0] !== 200 || statuses[1] !== 409) {
      console.error(`FAIL: Concurrency test failed! Expected [200, 409], received: [${statuses[0]}, ${statuses[1]}]`);
      process.exit(1);
    }
    console.log(`   ✔ PASS: Exactly one assign succeeded (200) and one failed with conflict (409)`);

    // 8. Provider lists assigned jobs
    console.log('\n8. Provider lists assigned jobs (GET /api/maintenance-requests?role=provider)...');
    const provJobsRes = await fetch(`${BASE_URL}/api/maintenance-requests?role=provider`, {
      headers: { Authorization: `Bearer ${providerToken}` },
    });
    const provJobsJson = await provJobsRes.json();
    if (!provJobsRes.ok || !Array.isArray(provJobsJson.data)) {
      console.error('FAIL: Provider job listing failed:', provJobsJson);
      process.exit(1);
    }
    const foundJob = provJobsJson.data.find((j) => j.id === requestId1);
    if (!foundJob) {
      console.error('FAIL: Assigned job not found in provider job listing:', provJobsJson.data);
      process.exit(1);
    }
    console.log(`   ✔ PASS: Assigned job is visible in provider job list (status: ${foundJob.status})`);

    // 8b. Live Privacy Check: No email exposed, phone exposed ONLY on assigned detail
    console.log('\n8b. Live Privacy Check (zero emails anywhere, phone visible ONLY on assigned request detail)...');
    const [detailProvRes, detailOwnerRes, provListRes, ownerListRes, provListJobsRes] = await Promise.all([
      fetch(`${BASE_URL}/api/maintenance-requests/${requestId1}`, {
        headers: { Authorization: `Bearer ${providerToken}` },
      }),
      fetch(`${BASE_URL}/api/maintenance-requests/${requestId1}`, {
        headers: { Authorization: `Bearer ${ownerToken}` },
      }),
      fetch(`${BASE_URL}/api/providers`, {
        headers: { Authorization: `Bearer ${ownerToken}` },
      }),
      fetch(`${BASE_URL}/api/maintenance-requests`, {
        headers: { Authorization: `Bearer ${ownerToken}` },
      }),
      fetch(`${BASE_URL}/api/maintenance-requests?role=provider`, {
        headers: { Authorization: `Bearer ${providerToken}` },
      }),
    ]);

    const [detailProvText, detailOwnerText, provListText, ownerListText, provListJobsText] = await Promise.all([
      detailProvRes.text(),
      detailOwnerRes.text(),
      provListRes.text(),
      ownerListRes.text(),
      provListJobsRes.text(),
    ]);

    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const phonePattern = /(?:\+?91)?[6-9]\d{9}/;

    const noEmail =
      !emailRegex.test(detailProvText) &&
      !emailRegex.test(detailOwnerText) &&
      !emailRegex.test(provListText) &&
      !emailRegex.test(ownerListText) &&
      !emailRegex.test(provListJobsText);

    const phoneInDetailOnly =
      phonePattern.test(detailProvText) &&
      phonePattern.test(detailOwnerText) &&
      !phonePattern.test(provListText) &&
      !phonePattern.test(ownerListText) &&
      !phonePattern.test(provListJobsText);

    if (noEmail && phoneInDetailOnly) {
      console.log('   ✔ PASS');
    } else {
      console.error('   ❌ FAIL');
      process.exit(1);
    }

    // 9. Provider tries to complete directly from ASSIGNED -> expects 409 INVALID_TRANSITION
    console.log('\n9. Provider tries to complete from ASSIGNED (expects 409 INVALID_TRANSITION)...');
    const prematureCompleteRes = await fetch(`${BASE_URL}/api/maintenance-requests/${requestId1}/complete`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${providerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ actualCost: '450.00' }),
    });
    const prematureCompleteJson = await prematureCompleteRes.json();
    if (prematureCompleteRes.status !== 409 || prematureCompleteJson.error?.code !== 'INVALID_TRANSITION') {
      console.error('FAIL: Expected 409 INVALID_TRANSITION, got:', prematureCompleteRes.status, prematureCompleteJson);
      process.exit(1);
    }
    console.log('   ✔ PASS: Direct completion from ASSIGNED rejected with 409 INVALID_TRANSITION');

    // 10. Provider starts job -> IN_PROGRESS
    console.log('\n10. Provider starts job (POST /api/maintenance-requests/:id/start)...');
    const startRes = await fetch(`${BASE_URL}/api/maintenance-requests/${requestId1}/start`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${providerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    const startJson = await startRes.json();
    if (!startRes.ok || startJson.data?.status !== 'IN_PROGRESS') {
      console.error('FAIL: Provider start failed:', startJson);
      process.exit(1);
    }
    console.log(`   ✔ PASS: Job transitioned to IN_PROGRESS`);

    // 11. Provider posts update note with tiny PNG photo (multipart)
    console.log('\n11. Provider posts update note with photo (POST /api/maintenance-requests/:id/updates)...');
    const formData = new FormData();
    const blob = new Blob([TINY_PNG_BUFFER], { type: 'image/png' });
    formData.append('file', blob, 'fitting.png');
    formData.append('note', 'Replaced valve seal, pressure tested lines, leak stopped.');

    const updateRes = await fetch(`${BASE_URL}/api/maintenance-requests/${requestId1}/updates`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${providerToken}` },
      body: formData,
    });
    const updateJson = await updateRes.json();
    if (!updateRes.ok || !updateJson.data?.id) {
      console.error('FAIL: Post update failed:', updateJson);
      process.exit(1);
    }
    const signedUrl = updateJson.data.mediaUrl;
    if (!signedUrl || signedUrl.includes('/public/')) {
      console.error('FAIL: Media URL is public or missing:', signedUrl);
      process.exit(1);
    }
    if (!signedUrl.includes('/sign/') && !signedUrl.includes('token=')) {
      console.error('FAIL: Media URL does not contain Supabase signature params:', signedUrl);
      process.exit(1);
    }
    // Track storage path for cleanup
    const dbUpdate = await prisma.maintenance_updates.findUnique({
      where: { id: updateJson.data.id },
    });
    if (dbUpdate?.media_url) {
      uploadedStoragePaths.push(dbUpdate.media_url);
    }
    console.log(`   ✔ PASS: Update posted with valid signed URL: ${signedUrl.substring(0, 60)}...`);

    // 12. Provider tries to complete without actualCost -> expects 400
    console.log('\n12. Provider tries to complete without actualCost (expects 400)...');
    const noCostRes = await fetch(`${BASE_URL}/api/maintenance-requests/${requestId1}/complete`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${providerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    const noCostJson = await noCostRes.json();
    if (noCostRes.status !== 400) {
      console.error('FAIL: Expected 400 when completing without actualCost, got:', noCostRes.status, noCostJson);
      process.exit(1);
    }
    console.log('   ✔ PASS: Completion without actualCost rejected with 400');

    // 13. Provider completes job with actualCost=450.00 -> COMPLETED
    console.log('\n13. Provider completes job with actualCost=450.00 (POST /api/maintenance-requests/:id/complete)...');
    const compRes = await fetch(`${BASE_URL}/api/maintenance-requests/${requestId1}/complete`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${providerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ actualCost: '450.00' }),
    });
    const compJson = await compRes.json();
    if (!compRes.ok || compJson.data?.status !== 'COMPLETED' || compJson.data?.actualCost !== '450.00') {
      console.error('FAIL: Job completion failed:', compJson);
      process.exit(1);
    }
    console.log(`   ✔ PASS: Job completed with actualCost: ${compJson.data.actualCost} and status: ${compJson.data.status}`);

    // 14. Owner leaves provider review (rating 5)
    console.log('\n14. Owner leaves provider review (POST /api/maintenance-requests/:id/review)...');
    const reviewRes = await fetch(`${BASE_URL}/api/maintenance-requests/${requestId1}/review`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rating: 5,
        comment: 'Outstanding repair work and fast response!',
      }),
    });
    const reviewJson = await reviewRes.json();
    if (!reviewRes.ok || reviewJson.data?.rating !== 5) {
      console.error('FAIL: Review creation failed:', reviewJson);
      process.exit(1);
    }
    console.log(`   ✔ PASS: Owner review submitted (rating: ${reviewJson.data.rating})`);

    // 15. Owner tries to leave second review on same request -> expects 409 ALREADY_REVIEWED
    console.log('\n15. Owner tries to submit duplicate review (expects 409 ALREADY_REVIEWED)...');
    const dupReviewRes = await fetch(`${BASE_URL}/api/maintenance-requests/${requestId1}/review`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rating: 4,
        comment: 'Second review attempt',
      }),
    });
    const dupReviewJson = await dupReviewRes.json();
    if (dupReviewRes.status !== 409 || dupReviewJson.error?.code !== 'ALREADY_REVIEWED') {
      console.error('FAIL: Expected 409 ALREADY_REVIEWED, got:', dupReviewRes.status, dupReviewJson);
      process.exit(1);
    }
    console.log('   ✔ PASS: Duplicate review rejected with 409 ALREADY_REVIEWED');

    // 16. Customer tries to access request detail -> expects 404
    console.log('\n16. Customer tries to view maintenance request detail (expects 404)...');
    const custDetailRes = await fetch(`${BASE_URL}/api/maintenance-requests/${requestId1}`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    if (custDetailRes.status !== 404) {
      console.error('FAIL: Expected 404 for unrelated customer, got:', custDetailRes.status);
      process.exit(1);
    }
    console.log('   ✔ PASS: Unrelated customer receives 404 NOT_FOUND');

    // 17. Second request flow (decline & cancel)
    console.log('\n17. Testing Second Request Flow (Decline & Cancel)...');
    const reqRes2 = await fetch(`${BASE_URL}/api/maintenance-requests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        propertyId,
        categoryId,
        title: 'Secondary valve inspection',
        description: 'Check secondary shutoff valve calibration.',
        priority: 'LOW',
      }),
    });
    const reqJson2 = await reqRes2.json();
    if (!reqRes2.ok || !reqJson2.data?.id) {
      console.error('FAIL: Second maintenance request creation failed:', reqJson2);
      process.exit(1);
    }
    requestId2 = reqJson2.data.id;
    console.log(`   ✔ Created second request (id: ${requestId2})`);

    // Assign provider
    const assign2Res = await fetch(`${BASE_URL}/api/maintenance-requests/${requestId2}/assign`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ providerId }),
    });
    if (!assign2Res.ok) {
      console.error('FAIL: Second assign failed:', await assign2Res.json());
      process.exit(1);
    }
    console.log(`   ✔ Assigned provider to second request`);

    // Provider declines
    const declineRes = await fetch(`${BASE_URL}/api/maintenance-requests/${requestId2}/decline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${providerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reason: 'Currently fully scheduled with emergency assignments.',
      }),
    });
    const declineJson = await declineRes.json();
    if (!declineRes.ok || declineJson.data?.status !== 'OPEN' || declineJson.data?.providerId !== null) {
      console.error('FAIL: Decline failed:', declineJson);
      process.exit(1);
    }
    console.log(`   ✔ PASS: Provider declined job; status reverted to OPEN and providerId reset to null`);

    // Owner cancels
    const cancelRes = await fetch(`${BASE_URL}/api/maintenance-requests/${requestId2}/cancel`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reason: 'Resolved internally; inspection no longer needed.',
      }),
    });
    const cancelJson = await cancelRes.json();
    if (!cancelRes.ok || cancelJson.data?.status !== 'CANCELLED') {
      console.error('FAIL: Cancel failed:', cancelJson);
      process.exit(1);
    }
    console.log(`   ✔ PASS: Owner cancelled request; status transitioned to CANCELLED`);

    // 18. Cleanup
    console.log('\n18. Cleaning up smoke test resources...');
    // Delete uploaded files from storage bucket & database media_assets
    for (const storagePath of uploadedStoragePaths) {
      await storageService.deleteFile('maintenance-media', storagePath);
      await prisma.media_assets.deleteMany({ where: { storage_path: storagePath } });
      console.log(`   ✔ Deleted storage file & media record: ${storagePath}`);
    }

    // Soft-delete test property
    if (propertyId) {
      const delPropRes = await fetch(`${BASE_URL}/api/properties/${propertyId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      console.log(`   ✔ Soft-deleted test property (id: ${propertyId}, status: ${delPropRes.status})`);
    }

    console.log('\n=== Smoke Maintenance Job Workflow Verification Completed Successfully ===\n');
  } catch (err) {
    console.error('FAIL: Unexpected smoke test error:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runSmokeMaintenance();
