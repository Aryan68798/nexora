import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL;
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD;
const PORT = process.env.PORT || '8000';
const BASE_URL = `http://localhost:${PORT}`;

async function runSmokeAuth() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Error: SUPABASE_URL or SUPABASE_ANON_KEY not set.');
    process.exit(1);
  }

  if (!TEST_USER_EMAIL || !TEST_USER_PASSWORD) {
    console.log('Skipping smoke test: TEST_USER_EMAIL or TEST_USER_PASSWORD not set in .env.');
    return;
  }

  console.log(`=== Smoke Test: Authentication Flow against ${BASE_URL} ===\n`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Sign in with password
  console.log('1. Signing in with test credentials via Supabase Auth...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
  });

  if (authError || !authData.session?.access_token) {
    console.error('Failed to sign in:', authError?.message || 'No session returned');
    process.exit(1);
  }
  console.log('   ✔ Supabase sign-in successful.');

  const token = authData.session.access_token;

  // 2. GET /api/auth/me
  console.log('\n2. Calling GET /api/auth/me with Bearer token...');
  const getMeRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const getMeJson = await getMeRes.json();
  console.log(`   HTTP Status: ${getMeRes.status}`);
  if (getMeRes.ok && getMeJson.data) {
    console.log(`   Profile Role: ${getMeJson.data.role}`);
    console.log(`   Account Active: ${getMeJson.data.is_active ?? getMeJson.data.isActive}`);
  } else {
    console.error('   GET /api/auth/me returned error:', getMeJson);
  }

  // 3. PATCH /api/auth/me
  console.log('\n3. Calling PATCH /api/auth/me...');
  const patchRes = await fetch(`${BASE_URL}/api/auth/me`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Smoke Test User',
    }),
  });

  await patchRes.json();
  console.log(`   HTTP Status: ${patchRes.status}`);
  console.log(`   PATCH /api/auth/me success: ${patchRes.ok}`);

  // 4. Role Authorization check: Non-admin calling /api/admin/users
  console.log('\n4. Testing Role Protection: GET /api/admin/users...');
  const adminRes = await fetch(`${BASE_URL}/api/admin/users`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  console.log(`   HTTP Status: ${adminRes.status} (expected 403 for non-admin)`);
  if (adminRes.status === 403) {
    console.log('   ✔ Access correctly denied with 403 FORBIDDEN for non-admin');
  } else if (getMeJson.data?.role === 'ADMIN' && adminRes.status === 200) {
    console.log('   ✔ User is ADMIN, access correctly granted with 200 OK');
  } else {
    console.log(`   Response status: ${adminRes.status}`);
  }

  console.log('\n=== Smoke Auth Verification Completed ===');
}

runSmokeAuth().catch((err) => {
  console.error('Smoke auth test error:', err.message);
  process.exit(1);
});
