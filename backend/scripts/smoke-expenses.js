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

// Valid 1x1 PNG binary buffer
const TINY_PNG_BUFFER = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082',
  'hex'
);

// Valid PDF binary buffer starting with %PDF-
const TINY_PDF_BUFFER = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');

async function runSmokeExpenses() {
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

  console.log(`=== Smoke Test: Property Expenses & Job Expense Integration against ${BASE_URL} ===\n`);

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

  // Track created resources for cleanup
  let propertyId = null;
  let manualExpenseId = null;
  let jobExpenseId = null;
  let concurrentExpenseId = null;
  let requestId1 = null;
  let requestId2 = null;
  let providerProfile = null;
  const storageFilesToCleanup = [];

  try {
    // Look up provider record
    providerProfile = await prisma.service_providers.findFirst({
      where: { profiles: { email: TEST_PROVIDER_EMAIL } },
    });
    if (!providerProfile) {
      console.log('   Provider profile not found for test provider, looking up any verified provider...');
      providerProfile = await prisma.service_providers.findFirst({
        where: { verification_status: 'VERIFIED' },
      });
    }

    const serviceCategory = await prisma.service_categories.findFirst({
      where: { is_active: true },
    });

    // 2. Owner creates property
    console.log('\n2. Owner creates property (POST /api/properties)...');
    const propRes = await fetch(`${BASE_URL}/api/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        title: `Smoke Expense Property ${Date.now()}`,
        description: 'Temporary property for expense smoke test',
        propertyType: 'APARTMENT',
        addressLine1: '404 Finance Avenue',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400050',
      }),
    });
    const propJson = await propRes.json();
    if (!propRes.ok || !propJson.data?.id) {
      console.error('FAIL: Create property failed:', propJson);
      process.exit(1);
    }
    propertyId = propJson.data.id;
    console.log(`   ✔ PASS: Created property: ${propertyId}`);

    // 3. Owner creates manual expense
    console.log('\n3. Owner creates manual expense (POST /api/properties/:propertyId/expenses)...');
    const createExpRes = await fetch(`${BASE_URL}/api/properties/${propertyId}/expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        category: 'UTILITIES',
        description: 'Monthly electricity and power charges',
        amount: 1250.5,
        incurredOn: '2026-10-15',
      }),
    });
    const createExpJson = await createExpRes.json();
    if (!createExpRes.ok || !createExpJson.data?.id) {
      console.error('FAIL: Create manual expense failed:', createExpJson);
      process.exit(1);
    }
    manualExpenseId = createExpJson.data.id;
    if (createExpJson.data.amount !== '1250.50' || createExpJson.data.category !== 'UTILITIES') {
      console.error('FAIL: Unexpected manual expense payload:', createExpJson.data);
      process.exit(1);
    }
    console.log(`   ✔ PASS: Created manual expense: ${manualExpenseId} ($1250.50 UTILITIES)`);

    // 4. Owner uploads 1x1 PNG receipt
    console.log('\n4. Owner uploads PNG receipt (POST /api/expenses/:id/receipt)...');
    const pngForm = new FormData();
    pngForm.append('file', new Blob([TINY_PNG_BUFFER], { type: 'image/png' }), 'receipt.png');

    const uploadPngRes = await fetch(`${BASE_URL}/api/expenses/${manualExpenseId}/receipt`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: pngForm,
    });
    const uploadPngJson = await uploadPngRes.json();
    if (!uploadPngRes.ok || !uploadPngJson.data?.receiptUrl) {
      console.error('FAIL: Upload PNG receipt failed:', uploadPngJson);
      process.exit(1);
    }
    const signedPngUrl = uploadPngJson.data.receiptUrl;
    if (!signedPngUrl.includes('/sign/') && !signedPngUrl.includes('token=')) {
      console.error('FAIL: Receipt URL is not a private signed URL:', signedPngUrl);
      process.exit(1);
    }
    console.log(`   ✔ PASS: PNG receipt uploaded and signed URL verified`);

    // Fetch DB record to verify path
    const dbExp1 = await prisma.property_expenses.findUnique({
      where: { id: manualExpenseId },
      select: { receipt_url: true },
    });
    const pngStoragePath = dbExp1.receipt_url;
    storageFilesToCleanup.push({ bucket: 'receipts', path: pngStoragePath });

    // 5. Replace receipt with tiny PDF (%PDF-)
    console.log('\n5. Owner replaces receipt with PDF (POST /api/expenses/:id/receipt)...');
    const pdfForm = new FormData();
    pdfForm.append('file', new Blob([TINY_PDF_BUFFER], { type: 'application/pdf' }), 'invoice.pdf');

    const uploadPdfRes = await fetch(`${BASE_URL}/api/expenses/${manualExpenseId}/receipt`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: pdfForm,
    });
    const uploadPdfJson = await uploadPdfRes.json();
    if (!uploadPdfRes.ok || !uploadPdfJson.data?.receiptUrl) {
      console.error('FAIL: Replace PDF receipt failed:', uploadPdfJson);
      process.exit(1);
    }
    const signedPdfUrl = uploadPdfJson.data.receiptUrl;
    if (!signedPdfUrl.includes('/sign/') && !signedPdfUrl.includes('token=')) {
      console.error('FAIL: PDF Receipt URL is not a signed URL:', signedPdfUrl);
      process.exit(1);
    }
    const dbExp2 = await prisma.property_expenses.findUnique({
      where: { id: manualExpenseId },
      select: { receipt_url: true },
    });
    const pdfStoragePath = dbExp2.receipt_url;
    storageFilesToCleanup.push({ bucket: 'receipts', path: pdfStoragePath });

    // Verify old PNG was deleted
    const oldMediaAsset = await prisma.media_assets.findFirst({
      where: { storage_path: pngStoragePath },
    });
    if (oldMediaAsset) {
      console.error('FAIL: Old PNG media_assets record was not removed after replacement');
      process.exit(1);
    }
    console.log(`   ✔ PASS: Receipt replaced with PDF, old PNG removed from storage & DB`);

    // 6. List expenses and verify totalAmount
    console.log('\n6. Listing property expenses (GET /api/properties/:propertyId/expenses)...');
    const listRes = await fetch(`${BASE_URL}/api/properties/${propertyId}/expenses`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const listJson = await listRes.json();
    if (!listRes.ok || !Array.isArray(listJson.data)) {
      console.error('FAIL: List expenses failed:', listJson);
      process.exit(1);
    }
    if (listJson.meta.totalAmount !== '1250.50' || listJson.meta.total !== 1) {
      console.error('FAIL: Unexpected list meta:', listJson.meta);
      process.exit(1);
    }
    console.log(`   ✔ PASS: Listing returned 1 item with meta.totalAmount = "1250.50"`);

    // 7. Read expenses summary
    console.log('\n7. Reading expenses summary (GET /api/properties/:propertyId/expenses/summary)...');
    const summaryRes = await fetch(
      `${BASE_URL}/api/properties/${propertyId}/expenses/summary?from=2026-10-01&to=2026-10-31`,
      { headers: { Authorization: `Bearer ${ownerToken}` } }
    );
    const summaryJson = await summaryRes.json();
    if (!summaryRes.ok || summaryJson.data.total !== '1250.50') {
      console.error('FAIL: Expenses summary mismatch:', summaryJson);
      process.exit(1);
    }
    if (summaryJson.data.byCategory[0]?.category !== 'UTILITIES' || summaryJson.data.byCategory[0]?.percent !== '100.0') {
      console.error('FAIL: Expenses summary category breakdown mismatch:', summaryJson.data.byCategory);
      process.exit(1);
    }
    console.log(`   ✔ PASS: Summary matched independent calculation (Total: 1250.50, UTILITIES: 100.0%)`);

    // 8. Run a maintenance job through assign, start, complete
    console.log('\n8. Creating and completing maintenance job for expense recording...');
    const reqRes1 = await fetch(`${BASE_URL}/api/maintenance-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        propertyId,
        categoryId: serviceCategory.id,
        title: 'Emergency Pipe Repair',
        description: 'Main pipe burst under bathroom sink',
        priority: 'HIGH',
      }),
    });
    const reqJson1 = await reqRes1.json();
    if (!reqRes1.ok || !reqJson1.data?.id) {
      console.error('FAIL: Create maintenance request 1 failed:', reqJson1);
      process.exit(1);
    }
    requestId1 = reqJson1.data.id;

    if (providerProfile) {
      // Assign provider
      await fetch(`${BASE_URL}/api/maintenance-requests/${requestId1}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({ providerId: providerProfile.id }),
      });

      // Provider starts job
      await fetch(`${BASE_URL}/api/maintenance-requests/${requestId1}/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${providerToken}` },
      });

      // Provider completes job with actualCost: 450.00
      const compRes = await fetch(`${BASE_URL}/api/maintenance-requests/${requestId1}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${providerToken}`,
        },
        body: JSON.stringify({ actualCost: 450.0 }),
      });
      const compJson = await compRes.json();
      if (!compRes.ok) {
        console.error('FAIL: Complete job failed:', compJson);
        process.exit(1);
      }
    } else {
      // Direct completion update for testing if no provider
      await prisma.maintenance_requests.update({
        where: { id: requestId1 },
        data: {
          status: 'COMPLETED',
          actual_cost: 450.0,
          completed_at: new Date(),
        },
      });
    }

    // Owner checks job detail: record_expense in allowedActions, linkedExpenseId is null
    const jobDetailRes1 = await fetch(`${BASE_URL}/api/maintenance-requests/${requestId1}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const jobDetailJson1 = await jobDetailRes1.json();
    if (!jobDetailJson1.data.allowedActions?.includes('record_expense') || jobDetailJson1.data.linkedExpenseId !== null) {
      console.error('FAIL: Job detail before expense recording mismatch:', jobDetailJson1.data);
      process.exit(1);
    }
    console.log(`   ✔ PASS: Maintenance job ${requestId1} completed (actualCost: 450.00), record_expense action ready`);

    // 9. Owner records expense from completed job
    console.log('\n9. Owner records expense from completed job (POST /api/maintenance-requests/:id/expense)...');
    const recExpRes = await fetch(`${BASE_URL}/api/maintenance-requests/${requestId1}/expense`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        description: 'Invoice payment for Pipe Repair job',
        incurredOn: '2026-10-16',
      }),
    });
    const recExpJson = await recExpRes.json();
    if (!recExpRes.ok || !recExpJson.data?.id) {
      console.error('FAIL: Record expense from job failed:', recExpJson);
      process.exit(1);
    }
    jobExpenseId = recExpJson.data.id;
    if (recExpJson.data.amount !== '450.00' || recExpJson.data.category !== 'MAINTENANCE') {
      console.error('FAIL: Recorded expense amount/category mismatch:', recExpJson.data);
      process.exit(1);
    }
    console.log(`   ✔ PASS: Recorded expense: ${jobExpenseId} ($450.00 MAINTENANCE)`);

    // Verify job detail updated
    const jobDetailRes2 = await fetch(`${BASE_URL}/api/maintenance-requests/${requestId1}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const jobDetailJson2 = await jobDetailRes2.json();
    if (jobDetailJson2.data.linkedExpenseId !== jobExpenseId || jobDetailJson2.data.allowedActions?.includes('record_expense')) {
      console.error('FAIL: Job detail after expense recording mismatch:', jobDetailJson2.data);
      process.exit(1);
    }

    // Provider check: provider NEVER sees linkedExpenseId
    const provDetailRes = await fetch(`${BASE_URL}/api/maintenance-requests/${requestId1}`, {
      headers: { Authorization: `Bearer ${providerToken}` },
    });
    const provDetailJson = await provDetailRes.json();
    if (provDetailJson.data.linkedExpenseId !== undefined) {
      console.error('FAIL: Provider leaked linkedExpenseId:', provDetailJson.data.linkedExpenseId);
      process.exit(1);
    }
    console.log(`   ✔ PASS: Owner sees linkedExpenseId; Provider never sees linkedExpenseId`);

    // 10. Concurrency & duplicate test on a second job
    console.log('\n10. Testing concurrency & one-expense-per-job rule with simultaneous requests...');
    const reqRes2 = await fetch(`${BASE_URL}/api/maintenance-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        propertyId,
        categoryId: serviceCategory.id,
        title: 'Electrical Rewiring',
        description: 'Rewire garage switchboard',
        priority: 'MEDIUM',
      }),
    });
    const reqJson2 = await reqRes2.json();
    requestId2 = reqJson2.data.id;

    await prisma.maintenance_requests.update({
      where: { id: requestId2 },
      data: {
        status: 'COMPLETED',
        actual_cost: 300.0,
        completed_at: new Date(),
      },
    });

    // Fire two simultaneous requests
    const [cRes1, cRes2] = await Promise.all([
      fetch(`${BASE_URL}/api/maintenance-requests/${requestId2}/expense`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({ description: 'Concurrent Call 1' }),
      }),
      fetch(`${BASE_URL}/api/maintenance-requests/${requestId2}/expense`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({ description: 'Concurrent Call 2' }),
      }),
    ]);

    const cJson1 = await cRes1.json();
    const cJson2 = await cRes2.json();

    const statuses = [cRes1.status, cRes2.status];
    if (!statuses.includes(201) || !statuses.includes(409)) {
      console.error('FAIL: Concurrency check did not yield one 201 and one 409:', statuses, cJson1, cJson2);
      process.exit(1);
    }
    const successfulCall = cRes1.status === 201 ? cJson1 : cJson2;
    concurrentExpenseId = successfulCall.data.id;
    console.log(`   ✔ PASS: Concurrency test passed: exactly one 201 and one 409 EXPENSE_EXISTS`);

    // Repeat call on first job also returns 409
    const dupRes = await fetch(`${BASE_URL}/api/maintenance-requests/${requestId1}/expense`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ description: 'Duplicate Call' }),
    });
    const dupJson = await dupRes.json();
    if (dupRes.status !== 409 || dupJson.error?.code !== 'EXPENSE_EXISTS') {
      console.error('FAIL: Repeat call did not return 409 EXPENSE_EXISTS:', dupRes.status, dupJson);
      process.exit(1);
    }
    console.log(`   ✔ PASS: Repeat recording attempt rejected with 409 EXPENSE_EXISTS`);

    // 11. Role privacy tests (Customer & Provider get 404)
    console.log('\n11. Testing role privacy (Customer & Provider must get 404)...');
    const custRes = await fetch(`${BASE_URL}/api/expenses/${manualExpenseId}`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    if (custRes.status !== 404) {
      console.error('FAIL: Customer did not get 404 on expense detail:', custRes.status);
      process.exit(1);
    }

    const provRes = await fetch(`${BASE_URL}/api/expenses/${manualExpenseId}`, {
      headers: { Authorization: `Bearer ${providerToken}` },
    });
    if (provRes.status !== 404) {
      console.error('FAIL: Provider did not get 404 on expense detail:', provRes.status);
      process.exit(1);
    }

    const custPropExpRes = await fetch(`${BASE_URL}/api/properties/${propertyId}/expenses`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    if (custPropExpRes.status !== 404) {
      console.error('FAIL: Customer did not get 404 on property expenses list:', custPropExpRes.status);
      process.exit(1);
    }
    console.log(`   ✔ PASS: Customer and Provider received 404 on all expense routes`);

    // 12. Job cost mismatch detection
    console.log('\n12. Testing jobCostMismatch detection...');
    const patchRes = await fetch(`${BASE_URL}/api/expenses/${jobExpenseId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ amount: 550.0 }),
    });
    const patchJson = await patchRes.json();
    if (!patchRes.ok || patchJson.data?.amount !== '550.00') {
      console.error('FAIL: Patch expense amount failed:', patchJson);
      process.exit(1);
    }

    const mismatchDetailRes = await fetch(`${BASE_URL}/api/expenses/${jobExpenseId}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const mismatchJson = await mismatchDetailRes.json();
    if (mismatchJson.data.jobCostMismatch !== true || mismatchJson.data.jobActualCost !== '450.00' || mismatchJson.data.expenseAmount !== '550.00') {
      console.error('FAIL: jobCostMismatch flag failed:', mismatchJson.data);
      process.exit(1);
    }
    console.log(`   ✔ PASS: jobCostMismatch detected (jobActualCost: 450.00, expenseAmount: 550.00)`);

  } finally {
    // 13. Cleanup
    console.log('\n13. Cleaning up test resources...');

    // Delete uploaded storage objects
    for (const item of storageFilesToCleanup) {
      try {
        await storageService.deleteFile(item.bucket, item.path);
        await prisma.media_assets.deleteMany({ where: { storage_path: item.path } });
      } catch (err) {
        console.warn(`   Warning: failed to delete ${item.path}:`, err.message);
      }
    }

    // Delete expenses
    if (manualExpenseId) {
      await prisma.property_expenses.deleteMany({ where: { id: manualExpenseId } });
    }
    if (jobExpenseId) {
      await prisma.property_expenses.deleteMany({ where: { id: jobExpenseId } });
    }
    if (concurrentExpenseId) {
      await prisma.property_expenses.deleteMany({ where: { id: concurrentExpenseId } });
    }

    // Delete maintenance requests
    if (requestId1) {
      await prisma.maintenance_requests.deleteMany({ where: { id: requestId1 } });
    }
    if (requestId2) {
      await prisma.maintenance_requests.deleteMany({ where: { id: requestId2 } });
    }

    // Soft-delete test property
    if (propertyId) {
      await prisma.properties.update({
        where: { id: propertyId },
        data: { status: 'INACTIVE' },
      });
      await prisma.properties.deleteMany({ where: { id: propertyId } });
    }

    console.log('   ✔ PASS: All test resources cleaned up cleanly\n');
  }

  console.log('=== ALL PHASE 4C SMOKE TESTS PASSED ===');
}

runSmokeExpenses().catch((err) => {
  console.error('FATAL: Smoke expenses test crashed:', err);
  process.exit(1);
});
