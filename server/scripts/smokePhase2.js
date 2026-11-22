// End-to-end check of Phase 2 against a RUNNING server.
//   npm run smoke -- http://localhost:5000 admin@example.com AdminPassword
// It makes its own test partner and a hotel in a brand-new city, so it never mixes with your data.
import { todayIST, addDaysIST } from '../src/utils/ist.js';

const [base = 'http://localhost:5000', adminEmail, adminPassword] = process.argv.slice(2);
if (!adminEmail || !adminPassword) {
  console.error('Usage: npm run smoke -- <server link> <admin email> <admin password>');
  process.exit(1);
}

let passed = 0;
let failed = 0;

async function call(method, path, { token, body } = {}) {
  const res = await fetch(base + path, {
    method: method.toUpperCase(), // fetch only auto-capitalizes some methods, not "patch"
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function check(name, condition, extra = '') {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name} ${extra}`);
  }
}

const run = Date.now();
const city = `Smoketown${run}`;
const today = todayIST();
const checkIn = addDaysIST(today, 9);
const checkOut = addDaysIST(today, 11); // nights: today+9 and today+10
const searchUrl = (extra = '') =>
  `/api/properties/search?city=${encodeURIComponent(city)}&checkIn=${checkIn}&checkOut=${checkOut}${extra}`;

console.log(`Testing ${base} (this may take a minute if the server was asleep)\n`);

// 1. People
console.log('Accounts');
const partnerSignup = await call('post', '/api/auth/signup', {
  body: { name: 'Smoke Partner', email: `smoke-partner-${run}@test.com`, password: 'password123', role: 'partner' },
});
check('partner signs up', partnerSignup.status === 201, JSON.stringify(partnerSignup.data));
const partner = partnerSignup.data.token;

const guestSignup = await call('post', '/api/auth/signup', {
  body: { name: 'Smoke Guest', email: `smoke-guest-${run}@test.com`, password: 'password123' },
});
const guest = guestSignup.data.token;

const adminLogin = await call('post', '/api/auth/login', { body: { email: adminEmail, password: adminPassword } });
check('admin logs in', adminLogin.status === 200 && adminLogin.data.user?.role === 'admin', JSON.stringify(adminLogin.data));
const admin = adminLogin.data.token;
if (!partner || !guest || !admin) {
  console.log('\nCannot go on without all three accounts.');
  process.exit(1);
}

// 2. Partner builds a hotel
console.log('\nPartner side');
const prop = await call('post', '/api/partner/properties', {
  token: partner,
  body: {
    name: 'Smoke Palace', city, address: '1 Test Road',
    amenities: ['WiFi'], images: ['https://example.com/a.jpg'],
  },
});
check('creates a property (pending)', prop.status === 201 && prop.data.property?.status === 'pending', JSON.stringify(prop.data));
const propertyId = prop.data.property?._id;

const guestCreate = await call('post', '/api/partner/properties', { token: guest, body: {} });
check('guest cannot create a property (403)', guestCreate.status === 403);

const room = await call('post', `/api/partner/properties/${propertyId}/room-types`, {
  token: partner, body: { name: 'Deluxe Double', basePrice: 450000, totalRooms: 3, maxGuests: 2 },
});
check('adds a room type', room.status === 201, JSON.stringify(room.data));
const roomId = room.data.roomType?._id;

const cal = await call('get', `/api/partner/room-types/${roomId}/calendar?from=${today}&to=${addDaysIST(today, 364)}`, { token: partner });
check('room type got 365 days of rows', cal.data.calendar?.length === 365, `got ${cal.data.calendar?.length}`);

const override = await call('put', `/api/partner/room-types/${roomId}/dates`, {
  token: partner, body: { from: addDaysIST(today, 10), to: addDaysIST(today, 10), price: 900000 },
});
check('sets a special price for one date', override.status === 200, JSON.stringify(override.data));

// 3. Pending hotels are hidden
console.log('\nApproval');
let search = await call('get', searchUrl());
check('pending hotel is hidden from search', search.status === 200 && search.data.total === 0, JSON.stringify(search.data));

const guestApprove = await call('patch', `/api/admin/properties/${propertyId}/approve`, { token: guest });
check('guest cannot approve (403)', guestApprove.status === 403);

const noReason = await call('patch', `/api/admin/properties/${propertyId}/reject`, { token: admin, body: {} });
check('reject without a reason is refused (400)', noReason.status === 400);

const reject = await call('patch', `/api/admin/properties/${propertyId}/reject`, { token: admin, body: { reason: 'Photos are blurry' } });
check('admin rejects with a reason', reject.status === 200 && reject.data.property?.status === 'rejected');

const fix = await call('put', `/api/partner/properties/${propertyId}`, { token: partner, body: { description: 'Fresh photos added' } });
check('editing a rejected hotel sends it back to pending', fix.data.property?.status === 'pending', JSON.stringify(fix.data));

const approve = await call('patch', `/api/admin/properties/${propertyId}/approve`, { token: admin });
check('admin approves', approve.status === 200 && approve.data.property?.status === 'approved');

// 4. Guest search
console.log('\nGuest search');
search = await call('get', searchUrl());
check('approved hotel shows up', search.data.total === 1 && search.data.items?.[0]?._id === propertyId, JSON.stringify(search.data));
check('price is the average per night (Rs 4,500 and Rs 9,000 -> Rs 6,750)', search.data.items?.[0]?.fromPrice === 675000, `got ${search.data.items?.[0]?.fromPrice}`);

search = await call('get', searchUrl('&guests=5'));
check('too many guests for the room -> no result', search.data.total === 0);

search = await call('get', searchUrl('&minPrice=800000'));
check('price filter removes it (min Rs 8,000)', search.data.total === 0);

search = await call('get', searchUrl('&maxPrice=700000'));
check('price filter keeps it (max Rs 7,000)', search.data.total === 1);

search = await call('get', searchUrl('&page=2&limit=1'));
check('page 2 is empty but still says total 1', search.data.items?.length === 0 && search.data.total === 1);

// 5. Details and price
console.log('\nDetails page');
const details = await call('get', `/api/properties/${propertyId}?checkIn=${checkIn}&checkOut=${checkOut}&guests=2`);
const room1 = details.data.roomTypes?.[0];
check('shows 3 rooms free and bookable', room1?.availableRooms === 3 && room1?.bookable === true, JSON.stringify(room1));
// night 1: Rs 4,500 +5% = 225 GST ; night 2: Rs 9,000 +18% = 1,620 GST
check('subtotal is Rs 13,500', room1?.pricePerRoom?.subtotal === 1350000, `got ${room1?.pricePerRoom?.subtotal}`);
check('GST is worked out per night (Rs 225 + Rs 1,620)', room1?.pricePerRoom?.gstTotal === 184500, `got ${room1?.pricePerRoom?.gstTotal}`);
check('grand total is Rs 15,345', room1?.pricePerRoom?.grandTotal === 1534500, `got ${room1?.pricePerRoom?.grandTotal}`);

// 6. Closing one night hides the hotel
console.log('\nEvery-night rule');
const close = await call('put', `/api/partner/room-types/${roomId}/dates`, {
  token: partner, body: { from: addDaysIST(today, 10), to: addDaysIST(today, 10), totalRooms: 0 },
});
check('partner closes one night (0 rooms)', close.status === 200, JSON.stringify(close.data));
search = await call('get', searchUrl());
check('hotel disappears when ONE night has no rooms', search.data.total === 0, JSON.stringify(search.data));

const reopen = await call('put', `/api/partner/room-types/${roomId}/dates`, {
  token: partner, body: { from: addDaysIST(today, 10), to: addDaysIST(today, 10), totalRooms: 3 },
});
search = await call('get', searchUrl());
check('hotel is back after reopening the night', reopen.status === 200 && search.data.total === 1);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
