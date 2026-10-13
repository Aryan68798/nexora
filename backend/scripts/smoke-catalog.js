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

// 1x1 valid PNG bytes
const TINY_PNG_BUFFER = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082',
  'hex'
);

async function runSmokeCatalog() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('FAIL: SUPABASE_URL or SUPABASE_ANON_KEY not set.');
    process.exit(1);
  }

  if (!TEST_OWNER_EMAIL || !TEST_OWNER_PASSWORD) {
    console.log('Skipping live catalog smoke test: TEST_OWNER_EMAIL or TEST_OWNER_PASSWORD not set in .env.');
    return;
  }

  console.log(`=== Smoke Test: Catalog Flow against ${BASE_URL} ===\n`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Sign in as Owner
  console.log('1. Signing in as Owner...');
  const { data: ownerAuth, error: ownerAuthError } = await supabase.auth.signInWithPassword({
    email: TEST_OWNER_EMAIL,
    password: TEST_OWNER_PASSWORD,
  });

  if (ownerAuthError || !ownerAuth.session?.access_token) {
    console.error('FAIL: Owner sign in failed:', ownerAuthError?.message || 'No session');
    process.exit(1);
  }
  const ownerToken = ownerAuth.session.access_token;
  console.log('   ✔ PASS: Owner authenticated');

  let propertyId = null;
  let spaceId = null;
  let mediaId = null;

  try {
    // 2. Create Property
    console.log('\n2. Creating Property (POST /api/properties)...');
    const propRes = await fetch(`${BASE_URL}/api/properties`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Smoke Test Tech Loft',
        propertyType: 'COMMERCIAL',
        addressLine1: '404 Innovation Way',
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
    console.log(`   ✔ PASS: Created property ${propertyId}`);

    // 3. Create Space
    console.log('\n3. Creating Space (POST /api/properties/:id/spaces)...');
    const spaceRes = await fetch(`${BASE_URL}/api/properties/${propertyId}/spaces`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Smoke Meeting Room',
        spaceType: 'OFFICE',
        capacity: 8,
        priceAmount: '750.00',
        priceUnit: 'HOUR',
        rules: 'Keep room tidy.',
      }),
    });
    const spaceJson = await spaceRes.json();
    if (!spaceRes.ok || !spaceJson.data?.id) {
      console.error('FAIL: Space creation failed:', spaceJson);
      process.exit(1);
    }
    spaceId = spaceJson.data.id;
    console.log(`   ✔ PASS: Created space ${spaceId}`);

    // 4. Upload PNG to Space Media
    console.log('\n4. Uploading Image to Space (POST /api/spaces/:id/media)...');
    const formData = new FormData();
    const blob = new Blob([TINY_PNG_BUFFER], { type: 'image/png' });
    formData.append('file', blob, 'sample.png');
    formData.append('caption', 'Smoke Test Space Cover');

    const uploadRes = await fetch(`${BASE_URL}/api/spaces/${spaceId}/media`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
      body: formData,
    });
    const uploadJson = await uploadRes.json();
    if (!uploadRes.ok || !uploadJson.data?.id) {
      console.error('FAIL: Media upload failed:', uploadJson);
      process.exit(1);
    }
    mediaId = uploadJson.data.id;
    console.log(`   ✔ PASS: Uploaded space media ${mediaId} (cover: ${uploadJson.data.isCover})`);

    // 5. Public Search & Verify Cover Image
    console.log('\n5. Searching spaces (GET /api/spaces?q=Smoke)...');
    const searchRes = await fetch(`${BASE_URL}/api/spaces?q=Smoke`);
    const searchJson = await searchRes.json();
    if (!searchRes.ok || !Array.isArray(searchJson.data)) {
      console.error('FAIL: Search failed:', searchJson);
      process.exit(1);
    }
    const found = searchJson.data.find((s) => s.id === spaceId);
    if (!found || !found.coverImageUrl) {
      console.error('FAIL: Space not found in search or missing coverImageUrl:', found);
      process.exit(1);
    }
    console.log('   ✔ PASS: Space found in public catalog with cover image');

    // 6. Customer Favorites Flow
    if (TEST_USER_EMAIL && TEST_USER_PASSWORD) {
      console.log('\n6. Signing in as Customer for Favorites test...');
      const { data: userAuth, error: userAuthError } = await supabase.auth.signInWithPassword({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
      });

      if (userAuthError || !userAuth.session?.access_token) {
        console.error('FAIL: Customer sign in failed:', userAuthError?.message);
      } else {
        const userToken = userAuth.session.access_token;
        console.log('   ✔ PASS: Customer authenticated');

        console.log('\n   6a. Adding favorite (PUT /api/favorites/:spaceId)...');
        const addFavRes = await fetch(`${BASE_URL}/api/favorites/${spaceId}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${userToken}` },
        });
        const addFavJson = await addFavRes.json();
        if (!addFavRes.ok) {
          console.error('   FAIL: Add favorite failed:', addFavJson);
        } else {
          console.log('   ✔ PASS: Space favorited');
        }

        console.log('\n   6b. Listing favorites (GET /api/favorites)...');
        const listFavRes = await fetch(`${BASE_URL}/api/favorites`, {
          headers: { Authorization: `Bearer ${userToken}` },
        });
        const listFavJson = await listFavRes.json();
        const hasFav = listFavJson.data?.some((f) => f.id === spaceId);
        if (listFavRes.ok && hasFav) {
          console.log('   ✔ PASS: Favorited space present in favorites list');
        } else {
          console.error('   FAIL: Favorite not found in list:', listFavJson);
        }

        console.log('\n   6c. Removing favorite (DELETE /api/favorites/:spaceId)...');
        const delFavRes = await fetch(`${BASE_URL}/api/favorites/${spaceId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${userToken}` },
        });
        if (delFavRes.ok) {
          console.log('   ✔ PASS: Space unfavorited');
        } else {
          console.error('   FAIL: Remove favorite failed');
        }
      }
    }
  } finally {
    // 7. Cleanup
    console.log('\n7. Cleaning up resources...');
    if (mediaId) {
      const delMedia = await fetch(`${BASE_URL}/api/space-media/${mediaId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      console.log(`   DELETE media: ${delMedia.ok ? 'PASS' : 'FAIL'}`);
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

  console.log('\n=== Smoke Catalog Verification Completed Successfully ===');
}

runSmokeCatalog().catch((err) => {
  console.error('Smoke catalog test error:', err.message);
  process.exit(1);
});
