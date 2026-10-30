import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const TEST_OWNER_EMAIL = process.env.TEST_OWNER_EMAIL;
const TEST_OWNER_PASSWORD = process.env.TEST_OWNER_PASSWORD;
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL;
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD;
const PORT = process.env.PORT || '8000';
const BASE_URL = `http://localhost:${PORT}`;

async function runSmokeBookings() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('FAIL: SUPABASE_URL or SUPABASE_ANON_KEY not set.');
    process.exit(1);
  }

  if (!TEST_OWNER_EMAIL || !TEST_OWNER_PASSWORD || !TEST_USER_EMAIL || !TEST_USER_PASSWORD) {
    console.log('Skipping live bookings smoke test: TEST_OWNER_* or TEST_USER_* credentials missing in .env.');
    return;
  }

  console.log(`=== Smoke Test: Booking & Payment Lifecycle Flow against ${BASE_URL} ===\n`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Authenticate Owner
  console.log('1. Authenticating Owner...');
  const { data: ownerAuth, error: ownerAuthError } = await supabase.auth.signInWithPassword({
    email: TEST_OWNER_EMAIL,
    password: TEST_OWNER_PASSWORD,
  });
  if (ownerAuthError || !ownerAuth.session?.access_token) {
    console.error('FAIL: Owner sign in failed:', ownerAuthError?.message);
    process.exit(1);
  }
  const ownerToken = ownerAuth.session.access_token;
  console.log('   ✔ PASS: Owner authenticated');

  // 2. Authenticate Customer
  console.log('\n2. Authenticating Customer...');
  const { data: custAuth, error: custAuthError } = await supabase.auth.signInWithPassword({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
  });
  if (custAuthError || !custAuth.session?.access_token) {
    console.error('FAIL: Customer sign in failed:', custAuthError?.message);
    process.exit(1);
  }
  const custToken = custAuth.session.access_token;
  console.log('   ✔ PASS: Customer authenticated');

  let propertyId = null;
  let spaceId = null;
  let booking1Id = null;
  let booking2Id = null;

  try {
    // 3. Create Property as Owner
    console.log('\n3. Creating Property as Owner (POST /api/properties)...');
    const propRes = await fetch(`${BASE_URL}/api/properties`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Smoke Test Business Center',
        propertyType: 'OFFICE_BUILDING',
        addressLine1: '909 Booking Way',
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
    console.log(`   ✔ PASS: Created property (id: ${propertyId})`);

    // 4. Create Space with Price 500/HOUR
    console.log('\n4. Creating Space (500/HOUR) (POST /api/properties/:id/spaces)...');
    const spaceRes = await fetch(`${BASE_URL}/api/properties/${propertyId}/spaces`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Smoke Executive Conference Room',
        spaceType: 'OFFICE',
        capacity: 12,
        priceAmount: '500.00',
        priceUnit: 'HOUR',
        rules: 'Standard boardroom rules apply.',
      }),
    });
    const spaceJson = await spaceRes.json();
    if (!spaceRes.ok || !spaceJson.data?.id) {
      console.error('FAIL: Space creation failed:', spaceJson);
      process.exit(1);
    }
    spaceId = spaceJson.data.id;
    console.log(`   ✔ PASS: Created space (id: ${spaceId})`);

    // Dates for booking 1 (2 days ahead, 2 hours duration)
    const baseTime = Date.now() + 48 * 3600000;
    const start1 = new Date(baseTime);
    start1.setMinutes(0, 0, 0);
    const end1 = new Date(start1.getTime() + 2 * 3600000);

    // 5. Customer Gets Pricing Quote
    console.log('\n5. Customer Requesting Quote (POST /api/bookings/quote)...');
    const quoteRes = await fetch(`${BASE_URL}/api/bookings/quote`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${custToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        spaceId,
        startAt: start1.toISOString(),
        endAt: end1.toISOString(),
        guestCount: 4,
      }),
    });
    const quoteJson = await quoteRes.json();
    if (!quoteRes.ok || !quoteJson.data?.pricing) {
      console.error('FAIL: Quote request failed:', quoteJson);
      process.exit(1);
    }
    const p = quoteJson.data.pricing;
    // Verify pricing numbers: 2 hours @ 500 = 1000 subtotal, 18% tax = 180, total = 1180
    if (p.subtotal !== '1000.00' || p.taxAmount !== '180.00' || p.totalAmount !== '1180.00') {
      console.error('FAIL: Quote calculations did not match expected values:', p);
      process.exit(1);
    }
    console.log(`   ✔ PASS: Quote verified (subtotal: ₹${p.subtotal}, tax: ₹${p.taxAmount}, total: ₹${p.totalAmount})`);

    // 6. Customer Books Slot 1
    console.log('\n6. Customer Books Slot 1 (POST /api/bookings)...');
    const bookRes = await fetch(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${custToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        spaceId,
        startAt: start1.toISOString(),
        endAt: end1.toISOString(),
        guestCount: 4,
      }),
    });
    const bookJson = await bookRes.json();
    if (bookRes.status !== 201 || !bookJson.data?.id) {
      console.error('FAIL: Booking 1 creation failed:', bookJson);
      process.exit(1);
    }
    booking1Id = bookJson.data.id;
    console.log(`   ✔ PASS: Booking 1 created in PENDING status (id: ${booking1Id})`);

    // 7. Overlapping Booking Request -> Expect 409
    console.log('\n7. Customer Attempts Overlapping Booking -> Expect 409 SLOT_UNAVAILABLE...');
    const overlapStart = new Date(start1.getTime() + 30 * 60000);
    const overlapEnd = new Date(overlapStart.getTime() + 60 * 60000);
    const overlapRes = await fetch(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${custToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        spaceId,
        startAt: overlapStart.toISOString(),
        endAt: overlapEnd.toISOString(),
        guestCount: 2,
      }),
    });
    const overlapJson = await overlapRes.json();
    if (overlapRes.status === 409 && overlapJson.error?.code === 'SLOT_UNAVAILABLE') {
      console.log('   ✔ PASS: Overlapping booking correctly rejected with 409 SLOT_UNAVAILABLE');
    } else {
      console.error('FAIL: Overlap booking was not rejected as expected:', overlapRes.status, overlapJson);
      process.exit(1);
    }

    // 8. Concurrent Booking Race Test
    console.log('\n8. Firing Two Identical Booking Requests Concurrently (Promise.all)...');
    const raceStart = new Date(start1.getTime() + 5 * 3600000);
    const raceEnd = new Date(raceStart.getTime() + 2 * 3600000);
    const racePayload = JSON.stringify({
      spaceId,
      startAt: raceStart.toISOString(),
      endAt: raceEnd.toISOString(),
      guestCount: 2,
    });

    const [raceRes1, raceRes2] = await Promise.all([
      fetch(`${BASE_URL}/api/bookings`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${custToken}`, 'Content-Type': 'application/json' },
        body: racePayload,
      }),
      fetch(`${BASE_URL}/api/bookings`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${custToken}`, 'Content-Type': 'application/json' },
        body: racePayload,
      }),
    ]);

    const raceJson1 = await raceRes1.json();
    const raceJson2 = await raceRes2.json();
    const statuses = [raceRes1.status, raceRes2.status].sort();

    if (statuses[0] === 201 && statuses[1] === 409) {
      console.log('   ✔ PASS: Concurrency race resolved correctly: exactly one 201 and one 409');
      booking2Id = raceRes1.status === 201 ? raceJson1.data?.id : raceJson2.data?.id;
    } else {
      console.error('FAIL: Concurrency race unexpected results:', {
        req1: { status: raceRes1.status, body: raceJson1 },
        req2: { status: raceRes2.status, body: raceJson2 },
      });
      process.exit(1);
    }

    // 9. Owner Confirms Booking 1
    console.log('\n9. Owner Confirms Booking 1 (PATCH /api/bookings/:id/status)...');
    const confirmRes = await fetch(`${BASE_URL}/api/bookings/${booking1Id}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'CONFIRMED' }),
    });
    const confirmJson = await confirmRes.json();
    if (confirmRes.ok && confirmJson.data?.booking?.status === 'CONFIRMED') {
      console.log('   ✔ PASS: Booking 1 confirmed by owner');
    } else {
      console.error('FAIL: Confirmation failed:', confirmJson);
      process.exit(1);
    }

    // 10. Customer Makes Partial Payment
    console.log('\n10. Customer Makes Partial Payment of ₹500 (POST /api/bookings/:id/payments)...');
    const pay1Res = await fetch(`${BASE_URL}/api/bookings/${booking1Id}/payments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${custToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ method: 'UPI', amount: 500 }),
    });
    const pay1Json = await pay1Res.json();
    if (pay1Res.status === 201 && pay1Json.data?.status === 'PAID') {
      console.log(`   ✔ PASS: Partial payment captured (txn: ${pay1Json.data.transactionReference})`);
    } else {
      console.error('FAIL: Partial payment failed:', pay1Json);
      process.exit(1);
    }

    // 11. Customer Attempts Overpayment -> Expect 400 OVERPAYMENT
    console.log('\n11. Customer Attempts Overpayment of ₹700 (Remaining ₹680) -> Expect 400 OVERPAYMENT...');
    const overpayRes = await fetch(`${BASE_URL}/api/bookings/${booking1Id}/payments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${custToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ method: 'CARD', amount: 700 }),
    });
    const overpayJson = await overpayRes.json();
    if (overpayRes.status === 400 && overpayJson.error?.code === 'OVERPAYMENT') {
      console.log('   ✔ PASS: Overpayment correctly rejected with 400 OVERPAYMENT');
    } else {
      console.error('FAIL: Overpayment was not rejected properly:', overpayRes.status, overpayJson);
      process.exit(1);
    }

    // 12. Customer Pays Remaining Balance
    console.log('\n12. Customer Pays Remaining Balance (POST /api/bookings/:id/payments)...');
    const pay2Res = await fetch(`${BASE_URL}/api/bookings/${booking1Id}/payments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${custToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ method: 'UPI' }), // default to remaining
    });
    const pay2Json = await pay2Res.json();
    if (pay2Res.status === 201 && pay2Json.data?.amount === '680.00') {
      console.log('   ✔ PASS: Remaining balance of ₹680.00 successfully paid in full');
    } else {
      console.error('FAIL: Final payment failed:', pay2Json);
      process.exit(1);
    }

    // 13. Customer Inspects Booking Detail
    console.log('\n13. Customer Reads Booking Detail (GET /api/bookings/:id)...');
    const getBookingRes = await fetch(`${BASE_URL}/api/bookings/${booking1Id}`, {
      headers: { Authorization: `Bearer ${custToken}` },
    });
    const getBookingJson = await getBookingRes.json();
    if (getBookingRes.ok && getBookingJson.data?.paidAmount === '1180.00') {
      console.log(`   ✔ PASS: Booking paid in full (paidAmount: ₹${getBookingJson.data.paidAmount}, history count: ${getBookingJson.data.statusHistory.length})`);
    } else {
      console.error('FAIL: Inspect booking failed:', getBookingJson);
      process.exit(1);
    }

    // 14. Owner Cancels Confirmed Booking -> Full Refund
    console.log('\n14. Owner Cancels Confirmed Booking -> Expect Full Refund of ₹1180.00...');
    const cancelRes = await fetch(`${BASE_URL}/api/bookings/${booking1Id}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'CANCELLED', reason: 'Emergency maintenance required' }),
    });
    const cancelJson = await cancelRes.json();
    if (cancelRes.ok && cancelJson.data?.refundedAmount === '1180.00') {
      console.log('   ✔ PASS: Booking cancelled with full refund');
    } else {
      console.error('FAIL: Cancellation failed:', cancelJson);
      process.exit(1);
    }

    // Verify payments are marked REFUNDED
    const paymentsRes = await fetch(`${BASE_URL}/api/bookings/${booking1Id}/payments`, {
      headers: { Authorization: `Bearer ${custToken}` },
    });
    const paymentsJson = await paymentsRes.json();
    const allRefunded = paymentsJson.data?.every((pay) => pay.status === 'REFUNDED');
    if (paymentsRes.ok && allRefunded) {
      console.log('   ✔ PASS: All payments verified as status REFUNDED');
    } else {
      console.error('FAIL: Payments status not REFUNDED:', paymentsJson);
      process.exit(1);
    }

    // 15. Check Customer Notifications
    console.log('\n15. Verifying Customer Notifications (GET /api/notifications)...');
    const notifRes = await fetch(`${BASE_URL}/api/notifications`, {
      headers: { Authorization: `Bearer ${custToken}` },
    });
    const notifJson = await notifRes.json();
    if (notifRes.ok && Array.isArray(notifJson.data)) {
      const types = notifJson.data.map((n) => n.type);
      console.log(`   ✔ PASS: Customer received notifications: ${types.slice(0, 4).join(', ')}`);
    } else {
      console.error('FAIL: Notification check failed:', notifJson);
    }
  } finally {
    // 16. Cleanup
    console.log('\n16. Cleaning Up Resources...');
    if (booking2Id) {
      await fetch(`${BASE_URL}/api/bookings/${booking2Id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      });
      console.log(`   Cancelled race booking (id: ${booking2Id})`);
    }
    if (spaceId) {
      const delSpace = await fetch(`${BASE_URL}/api/spaces/${spaceId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      console.log(`   DELETE space: ${delSpace.ok ? 'PASS' : 'FAIL'}`);
    }
    if (propertyId) {
      const delProp = await fetch(`${BASE_URL}/api/properties/${propertyId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      console.log(`   DELETE property: ${delProp.ok ? 'PASS' : 'FAIL'}`);
    }
  }

  console.log('\n=== Smoke Bookings Verification Completed Successfully ===');
}

runSmokeBookings().catch((err) => {
  console.error('Smoke bookings error:', err.message);
  process.exit(1);
});
