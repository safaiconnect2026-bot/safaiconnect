/**
 * Seed script — creates demo Firebase Auth accounts, Firestore user profiles,
 * and a complete complaint lifecycle (assignment, evidence, ratings) for E2E testing.
 *
 * Run: npx tsx scripts/seed-demo.ts
 *
 * This script is fully idempotent and ADDITIVE:
 *   - If a Firebase Auth account already exists, it reuses it.
 *   - Firestore docs use { merge: true } so existing data is preserved.
 *   - Complaints are created only if fewer than 10 demo complaints exist.
 *
 * Prerequisites:
 *   - Place your service account key at scripts/serviceAccountKey.json
 *     (Firebase Console → Project Settings → Service Accounts → Generate new private key)
 */

import admin from 'firebase-admin';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceAccountPath = existsSync(join(__dirname, 'serviceAccountKey.json'))
  ? join(__dirname, 'serviceAccountKey.json')
  : join(__dirname, 'service-account.json');

const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf-8'));

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db    = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });
const fauth = admin.auth();

const DEMO_PASSWORD = 'Demo@1234';

// ── Location DNA constants ─────────────────────────────────────────────
const CITY_ID   = 'nagpur';
const ZONE_ID   = 'zone_dharampeth';
const WARD_ID   = 'ward_13';
const CITY_NAME = 'Nagpur';
const ZONE_NAME = 'Dharampeth';
const WARD_NAME = 'Ward 13';

const demoUsers = [
  {
    email: 'superadmin@demo.com',
    name: 'Demo Superadmin',
    role: 'Superadmin',
    // Superadmin has global access — no location scoping
  },
  {
    email: 'admin@demo.com',
    name: 'Demo Admin',
    role: 'Admin',
    assignedZone: 'Dharampeth',
    cityId: CITY_ID,
    zoneId: ZONE_ID,
  },
  {
    email: 'worker@demo.com',
    name: 'Demo Worker',
    role: 'Worker',
    assignedZone: 'Dharampeth',
    cityId: CITY_ID,
    zoneId: ZONE_ID,
    wardId: WARD_ID,
  },
  {
    email: 'citizen@demo.com',
    name: 'Demo Citizen',
    role: 'Citizen',
    rewardPoints: 50,
    cityId: CITY_ID,
    zoneId: ZONE_ID,
    wardId: WARD_ID,
  },
  {
    email: 'champion@demo.com',
    name: 'Demo Champion',
    role: 'Green-Champion',
    rewardPoints: 200,
    cityId: CITY_ID,
    zoneId: ZONE_ID,
    wardId: WARD_ID,
  },
  {
    email: 'zonaladmin@demo.com',
    name: 'Demo Zonal Admin',
    role: 'Zonal-Admin',
    assignedZone: 'Dharampeth',
    zoneId: ZONE_ID,
    cityId: CITY_ID,
  },
];

// Demo complaints — all scoped to Nagpur/Dharampeth/Ward 13 so every role can see them
const demoComplaints = [
  { title: 'Garbage overflow near temple',   category: 'Waste Management',       location: 'Dharampeth Main Rd, Nagpur', lat: 21.1520, lng: 79.0720, status: 'SUBMITTED' },
  { title: 'Broken streetlight at park',     category: 'Street Lighting',        location: 'Seminary Hills, Nagpur',     lat: 21.1480, lng: 79.0680, status: 'ASSIGNED' },
  { title: 'Road pothole on bypass',         category: 'Road Damage',            location: 'Dharampeth Bypass, Nagpur',  lat: 21.1450, lng: 79.0750, status: 'RESOLVED' },
  { title: 'Drainage blocked near school',   category: 'Drainage/Sewage',        location: 'Dharampeth Square, Nagpur',  lat: 21.1500, lng: 79.0700, status: 'SUBMITTED' },
  { title: 'Open manhole on main road',      category: 'Drainage/Sewage',        location: 'Law College Sq, Nagpur',     lat: 21.1510, lng: 79.0710, status: 'UNDER_REVIEW' },
  { title: 'Waste dumping behind market',    category: 'Waste Management',       location: 'Dharampeth Market, Nagpur',  lat: 21.1530, lng: 79.0730, status: 'ZONAL_APPROVED' },
  { title: 'Broken footpath near hospital',  category: 'Public Property Damage', location: 'Civil Hospital Rd, Nagpur',  lat: 21.1540, lng: 79.0740, status: 'COMPLETED' },
  { title: 'Water pipe leak at corner',      category: 'Water Supply',           location: 'Telipura, Nagpur',           lat: 21.1490, lng: 79.0690, status: 'SUBMITTED' },
  { title: 'Noise from construction site',   category: 'Noise Pollution',        location: 'VCA Ground, Nagpur',         lat: 21.1460, lng: 79.0760, status: 'CLOSED' },
  { title: 'Overflowing bin at bus stop',    category: 'Waste Management',       location: 'Variety Square, Nagpur',     lat: 21.1470, lng: 79.0770, status: 'SUBMITTED' },
];

/**
 * Returns the Firebase Auth UID for the given email.
 * Creates the account (with DEMO_PASSWORD) if it doesn't exist yet.
 */
async function getOrCreateAuthUser(email: string, displayName: string): Promise<string> {
  try {
    const existing = await fauth.getUserByEmail(email);
    await fauth.updateUser(existing.uid, {
      password: DEMO_PASSWORD,
      displayName,
      emailVerified: true,
    });
    console.log(`  ↳ Auth account found  (uid: ${existing.uid})`);
    return existing.uid;
  } catch (err: any) {
    if (err.code === 'auth/user-not-found') {
      const created = await fauth.createUser({
        email,
        password: DEMO_PASSWORD,
        displayName,
        emailVerified: true,
      });
      console.log(`  ↳ Auth account created (uid: ${created.uid})`);
      return created.uid;
    }
    throw err;
  }
}

async function seed() {
  console.log('🌱 Starting demo seed...\n');

  const uidMap: Record<string, string> = {};

  // ── 1. Create / update user accounts ──────────────────────────────────
  for (const user of demoUsers) {
    console.log(`Processing ${user.email} (${user.role})...`);
    const uid = await getOrCreateAuthUser(user.email, user.name);
    uidMap[user.role] = uid;

    await db.collection('users').doc(uid).set({
      uid,
      email: user.email,
      name: user.name,
      role: user.role,
      assignedZone: (user as any).assignedZone || '',
      zoneId: (user as any).zoneId || '',
      cityId: (user as any).cityId || '',
      wardId: (user as any).wardId || '',
      rewardPoints: (user as any).rewardPoints ?? (user.role === 'Citizen' ? 0 : undefined),
      phone: '',
      address: '',
      citizenID: `CIT-DEMO-${uid.slice(-6).toUpperCase()}`,
      preferences: { notifications: true, language: 'en' },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      memberSince: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log(`  ✓ Firestore profile written\n`);
  }

  const citizenUid  = uidMap['Citizen']  || '';
  const workerUid   = uidMap['Worker']   || '';

  // ── 2. Seed demo complaints (only if < 10 demo complaints exist) ──────
  if (citizenUid) {
    const existing = await db.collection('complaints')
      .where('citizenId', '==', citizenUid)
      .limit(10).get();

    if (existing.size < 10) {
      console.log('Seeding demo complaints...');
      const complaintIds: string[] = [];

      for (const complaint of demoComplaints) {
        const ref = await db.collection('complaints').add({
          ...complaint,
          citizenId: citizenUid,
          citizenName: 'Demo Citizen',
          cityId: CITY_ID,
          cityName: CITY_NAME,
          zoneId: ZONE_ID,
          zoneName: ZONE_NAME,
          wardId: WARD_ID,
          wardName: WARD_NAME,
          description: `Demo: ${complaint.title} reported at ${complaint.location}`,
          imageUrl: '',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        complaintIds.push(ref.id);
      }
      console.log(`✓ ${demoComplaints.length} demo complaints seeded.\n`);

      // ── 3. Seed assignment for the ASSIGNED complaint (#1) ────────────
      if (workerUid && complaintIds[1]) {
        console.log('Seeding demo assignment...');
        await db.collection('assignments').add({
          complaintId: complaintIds[1],
          workerId: workerUid,
          assignedAt: admin.firestore.FieldValue.serverTimestamp(),
          workerStatus: 'ASSIGNED',
          lat: 21.1480,
          lng: 79.0680,
        });
        console.log('  ✓ Assignment created for "Broken streetlight"\n');
      }

      // ── 4. Seed assignment + evidence for the COMPLETED complaint (#6) ─
      if (workerUid && complaintIds[6]) {
        console.log('Seeding completed assignment with evidence...');
        const assignRef = await db.collection('assignments').add({
          complaintId: complaintIds[6],
          workerId: workerUid,
          assignedAt: admin.firestore.FieldValue.serverTimestamp(),
          workerStatus: 'COMPLETED',
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          lat: 21.1540,
          lng: 79.0740,
        });

        await db.collection('completion_evidence').add({
          complaintId: complaintIds[6],
          workerId: workerUid,
          imageUrl: 'https://placehold.co/600x400/22c55e/white?text=Evidence+Photo',
          description: 'Footpath repair completed',
          notes: 'Completed at lat: 21.1540, lng: 79.0740',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log('  ✓ Completed assignment + evidence created\n');
      }

      // ── 5. Seed assignment with ZONAL_APPROVED for admin verification (#5)
      if (workerUid && complaintIds[5] && uidMap['Zonal-Admin']) {
        console.log('Seeding zonal-approved assignment...');
        await db.collection('assignments').add({
          complaintId: complaintIds[5],
          workerId: workerUid,
          assignedAt: admin.firestore.FieldValue.serverTimestamp(),
          workerStatus: 'ZONAL_APPROVED',
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          zonalApproval: {
            approved: true,
            approvedBy: uidMap['Zonal-Admin'],
            approvedByName: 'Demo Zonal Admin',
            approvedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
          lat: 21.1530,
          lng: 79.0730,
        });

        await db.collection('completion_evidence').add({
          complaintId: complaintIds[5],
          workerId: workerUid,
          imageUrl: 'https://placehold.co/600x400/3b82f6/white?text=Waste+Cleared',
          description: 'Market area cleaned',
          notes: 'Completed at lat: 21.1530, lng: 79.0730',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log('  ✓ Zonal-approved assignment created (ready for admin final approval)\n');
      }

      // ── 6. Seed a rating for the CLOSED complaint (#8) ───────────────
      if (citizenUid && complaintIds[8]) {
        console.log('Seeding demo rating...');
        await db.collection('ratings').add({
          complaintId: complaintIds[8],
          citizenId: citizenUid,
          rating: 4,
          notes: 'Good work, resolved quickly!',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log('  ✓ Rating seeded for closed complaint\n');
      }

    } else {
      console.log(`ℹ️  ${existing.size} demo complaints already exist — skipping complaint seed.\n`);
    }
  } else {
    console.warn('⚠️  No citizen UID resolved — skipping complaints.');
  }

  // ── 7. Seed a collection booking ──────────────────────────────────────
  if (citizenUid) {
    console.log('Seeding demo collection booking...');
    await db.collection('collection_bookings').add({
      citizenId: citizenUid,
      citizenName: 'Demo Citizen',
      type: 'immediate',
      wasteType: 'Dry Waste',
      description: 'Old newspapers and cardboard boxes',
      location: 'Dharampeth Main Rd, Nagpur',
      lat: 21.1520,
      lng: 79.0720,
      cityId: CITY_ID,
      zoneId: ZONE_ID,
      wardId: WARD_ID,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('  ✓ Collection booking created\n');
  }

  console.log('✅ Seed complete.');
  console.log(`\nDemo credentials (all accounts):`);
  for (const u of demoUsers) {
    console.log(`  ${u.role.padEnd(14)} ${u.email}  /  ${DEMO_PASSWORD}`);
  }
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
