#!/usr/bin/env node
/* global Buffer, process, console, fetch, FormData, Blob */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../backend/.env');

function loadEnv() {
  const env = {};
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        env[key] = val;
      }
    }
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY;
const TEST_OWNER_EMAIL = env.TEST_OWNER_EMAIL;
const TEST_OWNER_PASSWORD = env.TEST_OWNER_PASSWORD;
const TEST_USER_EMAIL = env.TEST_USER_EMAIL;
const TEST_USER_PASSWORD = env.TEST_USER_PASSWORD;
const PORT = env.PORT || '4000';
const BASE_URL = `http://localhost:${PORT}`;

// 1x1 valid PNG bytes
const TINY_PNG_BUFFER = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082',
  'hex'
);

let allPassed = true;

function stepResult(stepNum, stepName, success, details = '') {
  const tag = success ? 'PASS' : 'FAIL';
  console.log(`[${tag}] Step ${stepNum}: ${stepName}${details ? ' - ' + details : ''}`);
  if (!success) {
    allPassed = false;
  }
}

async function runOwnerFlowCheck() {
  console.log(`\n==================================================`);
  console.log(`Nexora Owner Flow Verification against REAL Backend`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`==================================================\n`);

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    stepResult(0, 'Supabase Configuration Check', false, 'Missing SUPABASE_URL or SUPABASE_ANON_KEY in backend/.env');
    process.exit(1);
  }

  if (!TEST_OWNER_EMAIL || !TEST_OWNER_PASSWORD || !TEST_USER_EMAIL || !TEST_USER_PASSWORD) {
    stepResult(0, 'Test Credentials Check', false, 'Missing owner or customer test credentials in backend/.env');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let ownerToken = null;
  let customerToken = null;
  let propertyId = null;
  let spaceId = null;
  let bookingId = null;

  try {
    // 1. Sign in as Owner
    const { data: ownerAuth, error: ownerError } = await supabase.auth.signInWithPassword({
      email: TEST_OWNER_EMAIL,
      password: TEST_OWNER_PASSWORD,
    });
    if (ownerError || !ownerAuth?.session?.access_token) {
      stepResult(1, 'Sign in as Owner', false, ownerError?.message || 'No session returned');
      process.exit(1);
    }
    ownerToken = ownerAuth.session.access_token;
    stepResult(1, 'Sign in as Owner', true, 'Authenticated successfully');

    // 2. Sign in as Customer
    const { data: custAuth, error: custError } = await supabase.auth.signInWithPassword({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    });
    if (custError || !custAuth?.session?.access_token) {
      stepResult(2, 'Sign in as Customer', false, custError?.message || 'No session returned');
      process.exit(1);
    }
    customerToken = custAuth.session.access_token;
    stepResult(2, 'Sign in as Customer', true, 'Authenticated successfully');

    // 3. Create Property
    const uniqueNonce = Date.now().toString(36);
    const propertyTitle = `Verification Haveli ${uniqueNonce}`;
    const createPropRes = await fetch(`${BASE_URL}/api/properties`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: propertyTitle,
        description: 'A traditional courtyard estate with sandstone arches and garden verandas.',
        propertyType: 'VILLA',
        addressLine1: '42 Royal Crescent Road',
        city: 'Jaipur',
        state: 'Rajasthan',
        postalCode: '302001',
        country: 'India',
      }),
    });
    const createPropJson = await createPropRes.json();
    if (!createPropRes.ok || !createPropJson?.data?.id) {
      stepResult(3, 'Create Property (POST /api/properties)', false, JSON.stringify(createPropJson));
      process.exit(1);
    }
    propertyId = createPropJson.data.id;
    stepResult(3, 'Create Property (POST /api/properties)', true, `Created property ID: ${propertyId}`);

    // 4. Upload Tiny Generated PNG to Property Media
    const propFormData = new FormData();
    const propBlob = new Blob([TINY_PNG_BUFFER], { type: 'image/png' });
    propFormData.append('file', propBlob, 'property-cover.png');
    propFormData.append('caption', 'Property Courtyard');

    const uploadPropMediaRes = await fetch(`${BASE_URL}/api/properties/${propertyId}/media`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
      body: propFormData,
    });
    const uploadPropMediaJson = await uploadPropMediaRes.json();
    if (!uploadPropMediaRes.ok || !uploadPropMediaJson?.data?.id) {
      stepResult(4, 'Upload Property Cover Photo (POST /api/properties/:id/media)', false, JSON.stringify(uploadPropMediaJson));
    } else {
      stepResult(4, 'Upload Property Cover Photo (POST /api/properties/:id/media)', true, `Media ID: ${uploadPropMediaJson.data.id}`);
    }

    // 5. Create Space under Property
    const spaceName = `Veranda Suite ${uniqueNonce}`;
    const createSpaceRes = await fetch(`${BASE_URL}/api/properties/${propertyId}/spaces`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: spaceName,
        spaceType: 'STUDIO',
        capacity: 10,
        priceAmount: '1200.00',
        priceUnit: 'HOUR',
        rules: 'No loud music after 10 PM. Maintain historical architecture.',
      }),
    });
    const createSpaceJson = await createSpaceRes.json();
    if (!createSpaceRes.ok || !createSpaceJson?.data?.id) {
      stepResult(5, 'Create Rentable Space (POST /api/properties/:id/spaces)', false, JSON.stringify(createSpaceJson));
      process.exit(1);
    }
    spaceId = createSpaceJson.data.id;
    stepResult(5, 'Create Rentable Space (POST /api/properties/:id/spaces)', true, `Created space ID: ${spaceId}`);

    // 6. Upload Tiny Generated PNG to Space Media
    const spaceFormData = new FormData();
    const spaceBlob = new Blob([TINY_PNG_BUFFER], { type: 'image/png' });
    spaceFormData.append('file', spaceBlob, 'space-cover.png');
    spaceFormData.append('caption', 'Veranda Suite Cover');

    const uploadSpaceMediaRes = await fetch(`${BASE_URL}/api/spaces/${spaceId}/media`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
      body: spaceFormData,
    });
    const uploadSpaceMediaJson = await uploadSpaceMediaRes.json();
    if (!uploadSpaceMediaRes.ok || !uploadSpaceMediaJson?.data?.id) {
      stepResult(6, 'Upload Space Cover Photo (POST /api/spaces/:id/media)', false, JSON.stringify(uploadSpaceMediaJson));
    } else {
      stepResult(6, 'Upload Space Cover Photo (POST /api/spaces/:id/media)', true, `Media ID: ${uploadSpaceMediaJson.data.id}`);
    }

    // 7. Search as a Guest to Confirm Space Appears with Cover Image
    const searchRes = await fetch(`${BASE_URL}/api/spaces?q=${encodeURIComponent(uniqueNonce)}`);
    const searchJson = await searchRes.json();
    const foundSpace = searchJson?.data?.find((s) => s.id === spaceId);
    if (searchRes.ok && foundSpace && foundSpace.coverImageUrl) {
      stepResult(7, 'Guest Catalog Search (GET /api/spaces)', true, `Found space with cover image URL: ${foundSpace.coverImageUrl}`);
    } else {
      stepResult(7, 'Guest Catalog Search (GET /api/spaces)', false, `Space not found or missing cover image in search results: ${JSON.stringify(foundSpace)}`);
    }

    // 8. Customer Books Space
    const startAt = new Date(Date.now() + 72 * 3600000);
    startAt.setMinutes(0, 0, 0);
    const endAt = new Date(startAt.getTime() + 3 * 3600000);

    const bookRes = await fetch(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${customerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        spaceId,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        guestCount: 5,
      }),
    });
    const bookJson = await bookRes.json();
    if (bookRes.status !== 201 || !bookJson?.data?.id) {
      stepResult(8, 'Customer Books Space (POST /api/bookings)', false, JSON.stringify(bookJson));
      process.exit(1);
    }
    bookingId = bookJson.data.id;
    stepResult(8, 'Customer Books Space (POST /api/bookings)', true, `Created booking ID: ${bookingId} (Status: ${bookJson.data.status})`);

    // 9. Owner Confirms Booking
    const confirmRes = await fetch(`${BASE_URL}/api/bookings/${bookingId}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'CONFIRMED' }),
    });
    const confirmJson = await confirmRes.json();
    if (confirmRes.ok && confirmJson?.data?.booking?.status === 'CONFIRMED') {
      stepResult(9, 'Owner Confirms Booking (PATCH /api/bookings/:id/status)', true, `Status updated to CONFIRMED`);
    } else {
      stepResult(9, 'Owner Confirms Booking (PATCH /api/bookings/:id/status)', false, JSON.stringify(confirmJson));
    }

    // 10. Customer Pays
    const payRes = await fetch(`${BASE_URL}/api/bookings/${bookingId}/payments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${customerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ method: 'UPI' }),
    });
    const payJson = await payRes.json();
    if (payRes.status === 201 && payJson?.data?.status === 'PAID') {
      stepResult(10, 'Customer Pays Booking (POST /api/bookings/:id/payments)', true, `Payment captured. Txn Ref: ${payJson.data.transactionReference}`);
    } else {
      stepResult(10, 'Customer Pays Booking (POST /api/bookings/:id/payments)', false, JSON.stringify(payJson));
    }

  } catch (err) {
    console.error('Unexpected error during verification execution:', err);
    allPassed = false;
  } finally {
    // 11. Cleanup: Cancel Booking & Soft Delete Property
    console.log('\n--- Cleanup Routine ---');
    if (bookingId && customerToken) {
      try {
        const cancelRes = await fetch(`${BASE_URL}/api/bookings/${bookingId}/status`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${customerToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: 'CANCELLED', reason: 'Verification run finished' }),
        });
        const cancelJson = await cancelRes.json();
        if (cancelRes.ok) {
          console.log(`[PASS] Cleanup 11a: Booking ${bookingId} cancelled to clear active reservations`);
        } else {
          console.log(`[WARN] Cleanup 11a: Could not cancel booking: ${JSON.stringify(cancelJson)}`);
        }
      } catch (e) {
        console.log(`[WARN] Cleanup 11a error: ${e.message}`);
      }
    }

    if (propertyId && ownerToken) {
      try {
        const delRes = await fetch(`${BASE_URL}/api/properties/${propertyId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${ownerToken}`,
          },
        });
        const delJson = await delRes.json();
        if (delRes.ok && delJson?.data?.status === 'INACTIVE') {
          stepResult(11, 'Property Soft Delete (DELETE /api/properties/:id)', true, `Property ${propertyId} archived to INACTIVE`);
        } else {
          stepResult(11, 'Property Soft Delete (DELETE /api/properties/:id)', false, JSON.stringify(delJson));
        }
      } catch (e) {
        stepResult(11, 'Property Soft Delete (DELETE /api/properties/:id)', false, e.message);
      }
    }
  }

  console.log(`\n==================================================`);
  console.log(`Overall Result: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
  console.log(`==================================================\n`);

  process.exit(allPassed ? 0 : 1);
}

runOwnerFlowCheck();
