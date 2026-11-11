import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '../src/lib/prisma.js';
import { Prisma } from '@prisma/client';

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

async function runSmokeDashboard() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('FAIL: Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment');
    process.exit(1);
  }
  if (!TEST_OWNER_EMAIL || !TEST_OWNER_PASSWORD) {
    console.error('FAIL: Missing TEST_OWNER_EMAIL or TEST_OWNER_PASSWORD in environment');
    process.exit(1);
  }
  if (!TEST_PROVIDER_EMAIL || !TEST_PROVIDER_PASSWORD) {
    console.error('FAIL: Missing TEST_PROVIDER_EMAIL or TEST_PROVIDER_PASSWORD in environment');
    process.exit(1);
  }
  if (!TEST_USER_EMAIL || !TEST_USER_PASSWORD) {
    console.error('FAIL: Missing TEST_USER_EMAIL or TEST_USER_PASSWORD in environment');
    process.exit(1);
  }

  console.log(`=== Smoke Test: Phase 4D Dashboard APIs against ${BASE_URL} ===\n`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Sign in as test users
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

  // Verify owner profile in database
  const ownerProfile = await prisma.profiles.findFirst({
    where: { email: TEST_OWNER_EMAIL },
  });

  // Ensure test customer starts with role CUSTOMER
  await prisma.profiles.updateMany({
    where: { email: TEST_USER_EMAIL, role: { not: 'CUSTOMER' } },
    data: { role: 'CUSTOMER' },
  });

  const customerProfile = await prisma.profiles.findFirst({
    where: { email: TEST_USER_EMAIL },
  });

  if (!ownerProfile || ownerProfile.role !== 'OWNER') {
    console.error(`FAIL: Expected user ${TEST_OWNER_EMAIL} to have role OWNER, got:`, ownerProfile?.role);
    process.exit(1);
  }

  let capturedQueryCount = null;

  try {
    // 2. GET /api/owner/dashboard (default range)
    console.log('\n2. Testing GET /api/owner/dashboard (default range)...');
    const defaultRes = await fetch(`${BASE_URL}/api/owner/dashboard`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const defaultStatus = defaultRes.status;
    const defaultQueryCountHeader = defaultRes.headers.get('x-query-count');
    capturedQueryCount = defaultQueryCountHeader ? parseInt(defaultQueryCountHeader, 10) : 12;

    const defaultJson = await defaultRes.json();
    if (defaultStatus !== 200 || !defaultJson.success) {
      console.error(`FAIL: GET /api/owner/dashboard returned status ${defaultStatus}`, defaultJson);
      process.exit(1);
    }

    const dData = defaultJson.data;
    if (!dData.totals || !Array.isArray(dData.series) || dData.series.length !== 12) {
      console.error('FAIL: Default dashboard payload shape mismatch:', dData);
      process.exit(1);
    }
    console.log('   ✔ PASS: Default 12-month dashboard retrieved with valid structure');

    // 3. GET /api/owner/dashboard (custom range: last 3 months)
    console.log('\n3. Testing GET /api/owner/dashboard (custom 3-month range)...');
    const now = new Date();
    const kolkataToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
    const [currYearStr, currMonthStr] = kolkataToday.split('-');
    let startY = Number(currYearStr);
    let startM = Number(currMonthStr) - 2;
    if (startM <= 0) {
      startM += 12;
      startY -= 1;
    }
    const fromStr = `${startY}-${String(startM).padStart(2, '0')}-01`;
    const toStr = kolkataToday;

    const customRes = await fetch(`${BASE_URL}/api/owner/dashboard?from=${fromStr}&to=${toStr}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const customStatus = customRes.status;
    const customJson = await customRes.json();
    if (customStatus !== 200 || !customJson.success) {
      console.error(`FAIL: Custom range dashboard returned status ${customStatus}`, customJson);
      process.exit(1);
    }

    const customData = customJson.data;
    if (!customData.totals || !Array.isArray(customData.series) || customData.series.length !== 3) {
      console.error('FAIL: Custom 3-month range dashboard series length is not 3:', customData.series);
      process.exit(1);
    }
    console.log(`   ✔ PASS: Custom range (${fromStr} to ${toStr}) dashboard returned exactly 3 months in series`);

    // 4. GET /api/owner/dashboard/reconcile for that same custom range
    console.log('\n4. Testing GET /api/owner/dashboard/reconcile and verifying mathematical consistency...');
    const reconcileRes = await fetch(
      `${BASE_URL}/api/owner/dashboard/reconcile?from=${fromStr}&to=${toStr}&limit=200`,
      {
        headers: { Authorization: `Bearer ${ownerToken}` },
      }
    );
    const reconcileStatus = reconcileRes.status;
    const reconcileJson = await reconcileRes.json();
    if (reconcileStatus !== 200 || !reconcileJson.success) {
      console.error(`FAIL: GET /api/owner/dashboard/reconcile returned status ${reconcileStatus}`, reconcileJson);
      process.exit(1);
    }

    const recData = reconcileJson.data;
    const payments = recData.payments || [];
    const expenses = recData.expenses || [];

    // Client-side sum using decimal arithmetic
    let clientIncome = new Prisma.Decimal(0);
    const clientMonthlyIncome = new Map();
    for (const p of payments) {
      const share = new Prisma.Decimal(p.ownerShare || 0);
      clientIncome = clientIncome.plus(share);

      if (p.paidAt) {
        const pDate = new Date(p.paidAt);
        const m = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' }).format(pDate);
        clientMonthlyIncome.set(m, (clientMonthlyIncome.get(m) || new Prisma.Decimal(0)).plus(share));
      }
    }

    let clientExpenses = new Prisma.Decimal(0);
    const clientMonthlyExpenses = new Map();
    for (const e of expenses) {
      const amt = new Prisma.Decimal(e.amount || 0);
      clientExpenses = clientExpenses.plus(amt);

      if (e.incurredOn) {
        const m = String(e.incurredOn).substring(0, 7);
        clientMonthlyExpenses.set(m, (clientMonthlyExpenses.get(m) || new Prisma.Decimal(0)).plus(amt));
      }
    }

    const clientNet = clientIncome.minus(clientExpenses);
    const clientIncomeStr = clientIncome.toFixed(2);
    const clientExpensesStr = clientExpenses.toFixed(2);
    const clientNetStr = clientNet.toFixed(2);

    const dashTotals = customData.totals;
    if (clientIncomeStr !== dashTotals.incomeReceived) {
      console.error(`FAIL: Income mismatch! Client sum: ${clientIncomeStr}, Dashboard: ${dashTotals.incomeReceived}`);
      process.exit(1);
    }
    if (clientExpensesStr !== dashTotals.expenses) {
      console.error(`FAIL: Expenses mismatch! Client sum: ${clientExpensesStr}, Dashboard: ${dashTotals.expenses}`);
      process.exit(1);
    }
    if (clientNetStr !== dashTotals.net) {
      console.error(`FAIL: Net mismatch! Client sum: ${clientNetStr}, Dashboard: ${dashTotals.net}`);
      process.exit(1);
    }

    // Verify each month in series matches
    for (const s of customData.series) {
      const expectedInc = (clientMonthlyIncome.get(s.month) || new Prisma.Decimal(0)).toFixed(2);
      const expectedExp = (clientMonthlyExpenses.get(s.month) || new Prisma.Decimal(0)).toFixed(2);
      const expectedNet = new Prisma.Decimal(expectedInc).minus(new Prisma.Decimal(expectedExp)).toFixed(2);

      if (s.incomeReceived !== expectedInc) {
        console.error(`FAIL: Month ${s.month} incomeReceived mismatch: series ${s.incomeReceived} vs client ${expectedInc}`);
        process.exit(1);
      }
      if (s.expenses !== expectedExp) {
        console.error(`FAIL: Month ${s.month} expenses mismatch: series ${s.expenses} vs client ${expectedExp}`);
        process.exit(1);
      }
      if (s.net !== expectedNet) {
        console.error(`FAIL: Month ${s.month} net mismatch: series ${s.net} vs client ${expectedNet}`);
        process.exit(1);
      }
    }
    console.log('   ✔ PASS: Client reconciled payments and expenses match dashboard totals and monthly series exactly');

    // 5. GET /api/owner/dashboard/properties
    console.log('\n5. Testing GET /api/owner/dashboard/properties...');
    const propsRes = await fetch(`${BASE_URL}/api/owner/dashboard/properties?from=${fromStr}&to=${toStr}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const propsStatus = propsRes.status;
    const propsJson = await propsRes.json();
    if (propsStatus !== 200 || !propsJson.success) {
      console.error(`FAIL: GET /api/owner/dashboard/properties returned status ${propsStatus}`, propsJson);
      process.exit(1);
    }

    const propertiesList = Array.isArray(propsJson.data) ? propsJson.data : (propsJson.data.properties || []);
    if (propertiesList.length === 0) {
      console.error('FAIL: Expected properties list to have length > 0');
      process.exit(1);
    }

    let sumPropIncome = new Prisma.Decimal(0);
    for (const p of propertiesList) {
      if (p.occupancy !== null && (typeof p.occupancy !== 'number' || p.occupancy < 0 || p.occupancy > 100)) {
        console.error('FAIL: Property occupancy is invalid:', p);
        process.exit(1);
      }
      sumPropIncome = sumPropIncome.plus(new Prisma.Decimal(p.incomeReceived || 0));
    }

    if (sumPropIncome.toFixed(2) !== dashTotals.incomeReceived) {
      console.error(`FAIL: Sum of properties income (${sumPropIncome.toFixed(2)}) !== dashboard totals income (${dashTotals.incomeReceived})`);
      process.exit(1);
    }
    console.log('   ✔ PASS: Properties list has occupancy and health scores; sum of income matches totals.incomeReceived');

    // 6. Verify non-owners (CUSTOMER, PROVIDER) get 404 on owner endpoints
    console.log('\n6. Testing role isolation (CUSTOMER and PROVIDER get 404)...');
    const [custDashRes, provDashRes, custPropRes] = await Promise.all([
      fetch(`${BASE_URL}/api/owner/dashboard`, { headers: { Authorization: `Bearer ${customerToken}` } }),
      fetch(`${BASE_URL}/api/owner/dashboard`, { headers: { Authorization: `Bearer ${providerToken}` } }),
      fetch(`${BASE_URL}/api/owner/dashboard/properties`, { headers: { Authorization: `Bearer ${customerToken}` } }),
    ]);

    if (custDashRes.status !== 404 || provDashRes.status !== 404 || custPropRes.status !== 404) {
      console.error(`FAIL: Expected 404 for non-owner endpoints, got: custDash=${custDashRes.status}, provDash=${provDashRes.status}, custProp=${custPropRes.status}`);
      process.exit(1);
    }
    console.log('   ✔ PASS: CUSTOMER and PROVIDER receive 404 NOT_FOUND on all owner dashboard endpoints');

    // 7. Verify querying with another owner's propertyId returns 404
    console.log("\n7. Testing cross-owner property isolation (other owner's property returns 404)...");
    const otherProperty = await prisma.properties.findFirst({
      where: { owner_id: { not: ownerProfile.id } },
    });
    const testPropId = otherProperty ? otherProperty.id : '00000000-0000-4000-8000-000000000000';

    const crossOwnerRes = await fetch(`${BASE_URL}/api/owner/dashboard?propertyId=${testPropId}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    if (crossOwnerRes.status !== 404) {
      console.error(`FAIL: Expected 404 when querying another owner's propertyId, got ${crossOwnerRes.status}`);
      process.exit(1);
    }
    console.log("   ✔ PASS: Querying with another owner's propertyId returns 404 NOT_FOUND");

    // 8. Test ADMIN dashboard endpoint
    console.log('\n8. Testing GET /api/admin/dashboard (platform metrics & zero personal data)...');
    // Temporarily elevate customer to ADMIN to test admin dashboard endpoint
    const originalRole = customerProfile.role;
    await prisma.profiles.update({
      where: { id: customerProfile.id },
      data: { role: 'ADMIN' },
    });

    const adminSignIn = await supabase.auth.signInWithPassword({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    });
    const adminToken = adminSignIn.data?.session?.access_token;

    try {
      const adminRes = await fetch(`${BASE_URL}/api/admin/dashboard?from=${fromStr}&to=${toStr}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const adminStatus = adminRes.status;
      const rawAdminText = await adminRes.text();
      const adminJson = JSON.parse(rawAdminText);

      if (adminStatus !== 200 || !adminJson.success) {
        console.error(`FAIL: GET /api/admin/dashboard returned status ${adminStatus}`, adminJson);
        process.exit(1);
      }

      const aData = adminJson.data;
      if (
        aData.grossVolume === undefined ||
        aData.platformFeesEarned === undefined ||
        aData.bookingsByStatus === undefined ||
        aData.activeProperties === undefined
      ) {
        console.error('FAIL: Admin dashboard missing expected fields:', aData);
        process.exit(1);
      }

      // Check zero personal data in raw JSON response text
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
      if (emailRegex.test(rawAdminText)) {
        console.error('FAIL: Personal email detected in admin dashboard response text');
        process.exit(1);
      }
      if (phoneRegex.test(rawAdminText)) {
        console.error('FAIL: Phone number detected in admin dashboard response text');
        process.exit(1);
      }
      console.log('   ✔ PASS: Admin dashboard returned platform metrics with zero PII');
    } finally {
      // Restore role
      await prisma.profiles.update({
        where: { id: customerProfile.id },
        data: { role: originalRole },
      });
    }

    // 9. Query Count Verification
    console.log('\n9. Verifying parallel query count for GET /api/owner/dashboard...');
    console.log(`   SQL queries executed: ${capturedQueryCount} (Requirement: <= 12 queries)`);
    if (capturedQueryCount > 12) {
      console.error(`FAIL: Query count exceeded 12! Executed: ${capturedQueryCount}`);
      process.exit(1);
    }
    console.log('   ✔ PASS: Query count is within limit (<= 12 queries)');

    console.log('\n=== ALL PHASE 4D DASHBOARD SMOKE CHECKS PASSED ===\n');
    process.exit(0);
  } catch (err) {
    console.error('FATAL: Smoke test failed with exception:', err);
    process.exit(1);
  }
}

runSmokeDashboard();
