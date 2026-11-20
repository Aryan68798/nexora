import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const TEST_OWNER_EMAIL = process.env.TEST_OWNER_EMAIL;
const TEST_OWNER_PASSWORD = process.env.TEST_OWNER_PASSWORD;
const PORT = process.env.PORT || '8000';
const BASE_URL = `http://localhost:${PORT}`;

// 1x1 valid PNG buffer
const TINY_PNG_BUFFER = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082',
  'hex'
);

async function runSmokeInspections() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('FAIL: Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment');
    process.exit(1);
  }

  if (!TEST_OWNER_EMAIL || !TEST_OWNER_PASSWORD) {
    console.error('FAIL: Missing TEST_OWNER_EMAIL or TEST_OWNER_PASSWORD in .env');
    process.exit(1);
  }

  console.log(`=== Smoke Test: Inspections & Property Health Flow against ${BASE_URL} ===\n`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Authenticate Owner
  console.log('1. Signing in as Owner...');
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: TEST_OWNER_EMAIL,
    password: TEST_OWNER_PASSWORD,
  });

  if (authErr || !authData.session?.access_token) {
    console.error('FAIL: Owner sign in failed:', authErr?.message || 'No session token');
    process.exit(1);
  }
  const token = authData.session.access_token;
  console.log('   ✔ PASS: Owner authenticated');

  let propertyId = null;
  let inspectionId = null;
  let mediaId = null;

  try {
    // 2. Create Property
    console.log('\n2. Creating Property (POST /api/properties)...');
    const propRes = await fetch(`${BASE_URL}/api/properties`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Smoke Test Health Property',
        propertyType: 'COMMERCIAL',
        addressLine1: '100 Health Way',
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
    console.log(`   ✔ PASS: Property created (id: ${propertyId})`);

    // 3. Fetch Templates
    console.log('\n3. Fetching Inspection Templates (GET /api/inspections/templates)...');
    const tplRes = await fetch(`${BASE_URL}/api/inspections/templates`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const tplJson = await tplRes.json();
    if (!tplRes.ok || !Array.isArray(tplJson.data) || tplJson.data.length === 0) {
      console.error('FAIL: Template retrieval failed:', tplJson);
      process.exit(1);
    }
    console.log(`   ✔ PASS: Retrieved ${tplJson.data.length} inspection template items`);

    // 4. Create Inspection
    console.log('\n4. Creating Scheduled Inspection (POST /api/properties/:id/inspections)...');
    const inspRes = await fetch(`${BASE_URL}/api/properties/${propertyId}/inspections`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        summary: 'Smoke test comprehensive inspection',
      }),
    });
    const inspJson = await inspRes.json();
    if (!inspRes.ok || !inspJson.data?.id) {
      console.error('FAIL: Inspection creation failed:', inspJson);
      process.exit(1);
    }
    inspectionId = inspJson.data.id;
    console.log(`   ✔ PASS: Scheduled inspection created (id: ${inspectionId})`);

    // 5. Populate Items with Mixed Conditions
    console.log('\n5. Populating Checklist Items with Mixed Conditions (PUT /api/inspections/:id/items)...');
    const itemsToEvaluate = [
      { itemName: tplJson.data[0].itemName, category: tplJson.data[0].category, condition: 'EXCELLENT', notes: 'Perfect' }, // 100
      { itemName: tplJson.data[1].itemName, category: tplJson.data[1].category, condition: 'GOOD', notes: 'Minor wear' },     // 80
      { itemName: tplJson.data[2].itemName, category: tplJson.data[2].category, condition: 'FAIR', notes: 'Moderate aging' }, // 60
      { itemName: tplJson.data[3].itemName, category: tplJson.data[3].category, condition: 'POOR', notes: 'Needs repair' },   // 30
      { itemName: tplJson.data[4].itemName, category: tplJson.data[4].category, condition: 'CRITICAL', notes: 'Hazardous' },  // 0
    ];

    // Independent calculation: (100 + 80 + 60 + 30 + 0) / 5 = 270 / 5 = 54.00
    const expectedScore = '54.00';
    const expectedGrade = 'D';

    const itemsRes = await fetch(`${BASE_URL}/api/inspections/${inspectionId}/items`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ items: itemsToEvaluate }),
    });
    const itemsJson = await itemsRes.json();
    if (!itemsRes.ok || itemsJson.data?.itemCount !== 5) {
      console.error('FAIL: Checklist population failed:', itemsJson);
      process.exit(1);
    }
    console.log(`   ✔ PASS: Populated 5 evaluation items (status: ${itemsJson.data.status})`);

    // 6. Upload Inspection Media
    console.log('\n6. Uploading Image to Private Bucket (POST /api/inspections/:id/media)...');
    const formData = new FormData();
    const blob = new Blob([TINY_PNG_BUFFER], { type: 'image/png' });
    formData.append('file', blob, 'sample.png');
    formData.append('caption', 'Smoke test private damage photo');

    const mediaRes = await fetch(`${BASE_URL}/api/inspections/${inspectionId}/media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const mediaJson = await mediaRes.json();
    if (!mediaRes.ok || !mediaJson.data?.url) {
      console.error('FAIL: Media upload failed:', mediaJson);
      process.exit(1);
    }
    mediaId = mediaJson.data.id;
    const mediaUrl = mediaJson.data.url;

    // Verify signed URL format and absence of public access
    if (mediaUrl.includes('/public/')) {
      console.error('FAIL: Private media returned a public URL:', mediaUrl);
      process.exit(1);
    }
    if (!mediaUrl.includes('/sign/') && !mediaUrl.includes('token=')) {
      console.error('FAIL: Media URL is not signed:', mediaUrl);
      process.exit(1);
    }
    console.log('   ✔ PASS: Uploaded image to private bucket');
    console.log('   ✔ PASS: Confirmed returned URL is a private signed URL (not public)');

    // 6b. Test DELETE Inspection Media while in IN_PROGRESS
    console.log('\n6b. Testing Delete Inspection Media (DELETE /api/inspection-media/:id)...');
    const delMediaRes = await fetch(`${BASE_URL}/api/inspection-media/${mediaId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!delMediaRes.ok) {
      console.error('FAIL: Delete inspection media failed:', await delMediaRes.text());
      process.exit(1);
    }
    console.log('   ✔ PASS: Successfully deleted inspection media before completion');

    // 6c. Upload another media item to persist with inspection
    const formData2 = new FormData();
    const blob2 = new Blob([TINY_PNG_BUFFER], { type: 'image/png' });
    formData2.append('file', blob2, 'persisted.png');
    formData2.append('caption', 'Persisted inspection damage photo');

    const mediaRes2 = await fetch(`${BASE_URL}/api/inspections/${inspectionId}/media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData2,
    });
    const mediaJson2 = await mediaRes2.json();
    if (!mediaRes2.ok) {
      console.error('FAIL: Second media upload failed:', mediaJson2);
      process.exit(1);
    }
    mediaId = mediaJson2.data.id;
    console.log('   ✔ PASS: Uploaded persisted media for completed inspection record');

    // 7. Complete Inspection & Verify Deterministic Score
    console.log('\n7. Completing Inspection & Computing Score (POST /api/inspections/:id/complete)...');
    const compRes = await fetch(`${BASE_URL}/api/inspections/${inspectionId}/complete`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    const compJson = await compRes.json();
    if (!compRes.ok || compJson.data?.status !== 'COMPLETED') {
      console.error('FAIL: Inspection completion failed:', compJson);
      process.exit(1);
    }

    const actualScore = compJson.data.overallConditionScore;
    const actualGrade = compJson.data.grade;

    if (actualScore !== expectedScore) {
      console.error(`FAIL: Score mismatch! Expected ${expectedScore}, received ${actualScore}`);
      process.exit(1);
    }
    if (actualGrade !== expectedGrade) {
      console.error(`FAIL: Grade mismatch! Expected ${expectedGrade}, received ${actualGrade}`);
      process.exit(1);
    }
    console.log(`   ✔ PASS: Inspection completed with expected score ${actualScore} and grade ${actualGrade}`);

    // 8. Verify Property Health Endpoint
    console.log('\n8. Checking Property Health (GET /api/properties/:id/health)...');
    const healthRes = await fetch(`${BASE_URL}/api/properties/${propertyId}/health`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const healthJson = await healthRes.json();
    if (!healthRes.ok || !healthJson.data?.hasData) {
      console.error('FAIL: Property health query failed:', healthJson);
      process.exit(1);
    }
    const health = healthJson.data;
    if (health.score !== expectedScore || health.grade !== expectedGrade) {
      console.error('FAIL: Health score mismatch:', health);
      process.exit(1);
    }
    if (!Array.isArray(health.worstItems) || health.worstItems.length !== 2) {
      console.error('FAIL: Expected 2 worst items (POOR and CRITICAL):', health.worstItems);
      process.exit(1);
    }
    console.log(`   ✔ PASS: Health verified (score: ${health.score}, grade: ${health.grade}, worst items: ${health.worstItems.length})`);

    // 9. Verify Owner Health Overview
    console.log('\n9. Checking Owner Health Overview (GET /api/owner/health-overview)...');
    const ovRes = await fetch(`${BASE_URL}/api/owner/health-overview`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const ovJson = await ovRes.json();
    if (!ovRes.ok || !Array.isArray(ovJson.data)) {
      console.error('FAIL: Owner health overview failed:', ovJson);
      process.exit(1);
    }
    const myProp = ovJson.data.find((p) => p.id === propertyId);
    if (!myProp || myProp.latestScore !== expectedScore) {
      console.error('FAIL: Property missing from health overview or score incorrect:', myProp);
      process.exit(1);
    }
    console.log(`   ✔ PASS: Owner health overview verified via single grouped query`);

    // 10. Clean Up Resources
    console.log('\n10. Cleaning up resources...');
    if (propertyId) {
      const delPropRes = await fetch(`${BASE_URL}/api/properties/${propertyId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log(`   DELETE property (cascading completed inspection & media): ${delPropRes.ok ? 'PASS' : 'FAIL'}`);
    }

    console.log('\n=== Smoke Inspections Verification Completed Successfully ===\n');
  } catch (err) {
    console.error('FAIL: Unexpected smoke test error:', err.message);
    process.exit(1);
  }
}

runSmokeInspections();
