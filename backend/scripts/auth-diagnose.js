import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '../src/lib/prisma.js';
import { env } from '../src/config/env.js';

async function main() {
  console.log('=== Nexora Auth Diagnostic Tool ===\n');
  let overallPass = true;

  // 1. Supabase Settings
  console.log('1. Supabase Auth Public Settings:');
  try {
    const settingsUrl = `${env.SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/settings`;
    const res = await fetch(settingsUrl, {
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
      },
    });

    if (!res.ok) {
      console.log(`   [FAIL] Could not retrieve Supabase settings. HTTP ${res.status} ${res.statusText}`);
      overallPass = false;
    } else {
      const settings = await res.json();
      const disableSignup = Boolean(settings.disable_signup);
      const emailEnabled = settings.external ? Boolean(settings.external.email) : true;
      const autoconfirm = Boolean(settings.mailer_autoconfirm);

      console.log(`   - Email sign-up enabled (disable_signup === false): ${!disableSignup ? 'PASS' : 'FAIL'}`);
      console.log(`   - Email provider enabled: ${emailEnabled ? 'PASS' : 'FAIL'}`);
      console.log(`   - Email confirmation required (mailer_autoconfirm): ${autoconfirm ? 'NO (auto-confirm is ON)' : 'YES (email confirmation is REQUIRED)'}`);

      if (disableSignup || !emailEnabled) {
        console.log('   -> [FAIL] User signup is restricted or email provider disabled in Supabase.');
        overallPass = false;
      } else {
        console.log('   -> [PASS] Supabase auth settings allow public email registrations.');
      }
    }
  } catch (err) {
    console.log(`   [FAIL] Supabase settings request failed: ${err.message}`);
    overallPass = false;
  }
  console.log('');

  // 2. Database Trigger & Schema Check (Prisma $queryRaw)
  console.log('2. Database Trigger & Policy Verification:');
  try {
    // Check trigger on_auth_user_created
    const triggers = await prisma.$queryRaw`
      SELECT tgname 
      FROM pg_trigger 
      WHERE tgname = 'on_auth_user_created';
    `;
    const triggerExists = Array.isArray(triggers) && triggers.length > 0;
    console.log(`   - Trigger "on_auth_user_created" on auth.users: ${triggerExists ? 'PASS (exists)' : 'FAIL (not found)'}`);

    // Check function public.handle_new_user
    const functions = await prisma.$queryRaw`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
        AND routine_name = 'handle_new_user';
    `;
    const functionExists = Array.isArray(functions) && functions.length > 0;
    console.log(`   - Function "public.handle_new_user": ${functionExists ? 'PASS (exists)' : 'FAIL (not found)'}`);

    // Check pg_policies count for public schema
    const policies = await prisma.$queryRaw`
      SELECT count(*)::int as count 
      FROM pg_policies 
      WHERE schemaname = 'public';
    `;
    const policyCount = policies[0]?.count ?? 0;
    console.log(`   - Public schema Row Level Security pg_policies count: ${policyCount}`);

    if (triggerExists && functionExists) {
      console.log('   -> [PASS] Database trigger and handler function exist.');
    } else {
      console.log('   -> [FAIL] Database trigger or handler function missing. Relying on fallback profile creation in requireAuth.');
    }
  } catch (err) {
    console.log(`   [FAIL] Database query failed: ${err.message}`);
    overallPass = false;
  }
  console.log('');

  // 3. Live Signup Test
  console.log('3. Live Signup Diagnostic:');
  const timestamp = Date.now();
  const testEmail = `signup-check+${timestamp}@example.com`;
  // Generate random strong password without printing it
  const strongPassword = `Nx_${crypto.randomBytes(8).toString('hex')}!9A`;
  let createdUserId = null;
  let testSession = null;

  const anonClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data, error } = await anonClient.auth.signUp({
      email: testEmail,
      password: strongPassword,
      options: {
        data: {
          name: 'Diagnostic Tester',
          role: 'CUSTOMER',
        },
      },
    });

    if (error) {
      console.log(`   - Live signup outcome: HTTP error / rejected by Supabase`);
      console.log(`   - Error message: ${error.message} (status: ${error.status || 'unknown'})`);
      console.log(`   -> [FAIL] Live signup failed for test address.`);
      overallPass = false;
    } else {
      createdUserId = data?.user?.id || null;
      testSession = data?.session || null;
      console.log(`   - Live signup HTTP status: 200 OK`);
      console.log(`   - User ID created: ${createdUserId ? 'YES' : 'NO'}`);

      if (!testSession) {
        console.log(`   - Session returned: NO (Email confirmation is required by Supabase project settings; user must confirm email before session is issued)`);
        console.log(`   -> [PASS] Live signup succeeded in pending-confirmation state.`);
      } else {
        console.log(`   - Session returned: YES (Active session token provided)`);

        // Call GET /api/auth/me on running backend
        try {
          const backendUrl = `http://localhost:${env.PORT || 8000}/api/auth/me`;
          const meRes = await fetch(backendUrl, {
            headers: {
              Authorization: `Bearer ${testSession.access_token}`,
            },
          });
          console.log(`   - GET /api/auth/me HTTP status: ${meRes.status} ${meRes.statusText}`);

          if (meRes.ok) {
            const meJson = await meRes.json();
            const profileRole = meJson?.data?.role;
            console.log(`   - Profile role in database: ${profileRole}`);
            if (profileRole === 'CUSTOMER') {
              console.log('   -> [PASS] Verified backend profile exists with role CUSTOMER.');
            } else {
              console.log(`   -> [FAIL] Profile role is ${profileRole}, expected CUSTOMER.`);
              overallPass = false;
            }
          } else {
            console.log('   -> [FAIL] GET /api/auth/me failed on running backend.');
            overallPass = false;
          }
        } catch (meErr) {
          console.log(`   - Note: Could not call local backend: ${meErr.message}`);
        }
      }
    }
  } catch (err) {
    console.log(`   [FAIL] Live signup threw exception: ${err.message}`);
    overallPass = false;
  }
  console.log('');

  // 4. Cleanup
  console.log('4. Cleanup Test User:');
  if (createdUserId) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceRoleKey) {
      try {
        const adminClient = createClient(env.SUPABASE_URL, serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { error: delErr } = await adminClient.auth.admin.deleteUser(createdUserId);
        if (delErr) {
          console.log(`   [FAIL] Could not delete test user via admin API: ${delErr.message}`);
          console.log(`   - Note: Please manually delete user ${testEmail} in Supabase dashboard.`);
        } else {
          console.log(`   - User deleted from auth.users: PASS`);

          // Check if profile was cascaded
          const profileRow = await prisma.profiles.findUnique({
            where: { id: createdUserId },
          });
          if (!profileRow) {
            console.log(`   - Profile cascade deletion: PASS (profile row removed)`);
          } else {
            console.log(`   - Profile cascade deletion: NOT CASCADED (profile row still exists)`);
            // Clean up profile manually if cascade didn't catch it
            await prisma.profiles.delete({ where: { id: createdUserId } }).catch(() => {});
          }
          console.log(`   -> [PASS] Test user cleaned up successfully.`);
        }
      } catch (adminErr) {
        console.log(`   [FAIL] Admin cleanup failed: ${adminErr.message}`);
      }
    } else {
      console.log(`   - SUPABASE_SERVICE_ROLE_KEY not configured in env; cannot delete test user automatically.`);
      console.log(`   - Please remove test account in Supabase dashboard: ${testEmail}`);
    }
  } else {
    console.log('   - No test user was created; nothing to clean up.');
  }

  console.log('\n=== Diagnostic Summary ===');
  console.log(`Result: ${overallPass ? 'ALL CHECKS PASSED' : 'DIAGNOSTIC IDENTIFIED ISSUES'}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('[FATAL] auth-diagnose script error:', err);
  process.exit(1);
});
