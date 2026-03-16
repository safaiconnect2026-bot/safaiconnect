/**
 * Seed script — creates demo Firebase Auth accounts AND Firestore user profiles.
 * Run: npx tsx scripts/seed-demo.ts
 *
 * This script is fully idempotent:
 *   - If a Firebase Auth account for the email already exists, it reuses it.
 *   - If it doesn't exist, it creates it.
 *   - Firestore docs are always written with the CORRECT Auth UID.
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

const demoUsers = [
  {
    email: 'superadmin@demo.com',
    name: 'Demo Superadmin',
    role: 'Superadmin',
  },
  {
    email: 'admin@demo.com',
    name: 'Demo Admin',
    role: 'Admin',
    assignedZone: 'Zone A',
  },
  {
    email: 'worker@demo.com',
    name: 'Demo Worker',
    role: 'Worker',
    assignedZone: 'Zone A',
  },
  {
    email: 'citizen@demo.com',
    name: 'Demo Citizen',
    role: 'Citizen',
    rewardPoints: 50,
  },
  {
    email: 'champion@demo.com',
    name: 'Demo Champion',
    role: 'Green-Champion',
    rewardPoints: 200,
  },
  {
    email: 'zonaladmin@demo.com',
    name: 'Demo Zonal Admin',
    role: 'Zonal-Admin',
    assignedZone: 'Dharampeth',
    zoneId: 'zone_dharampeth',
    cityId: 'nagpur',
  },
];

// Demo complaints with lat/lng for heatmap demo
const demoComplaints = [
  { title: 'Garbage overflow',      category: 'Waste Management',        location: 'Andheri West, Mumbai',      lat: 19.1136, lng: 72.8697, status: 'SUBMITTED' },
  { title: 'Broken streetlight',    category: 'Street Lighting',         location: 'Bandra East, Mumbai',       lat: 19.0596, lng: 72.8295, status: 'ASSIGNED' },
  { title: 'Road pothole',          category: 'Road Damage',             location: 'Powai, Mumbai',             lat: 19.1176, lng: 72.9060, status: 'RESOLVED' },
  { title: 'Drainage blocked',      category: 'Drainage/Sewage',         location: 'Connaught Place, Delhi',    lat: 28.6315, lng: 77.2167, status: 'SUBMITTED' },
  { title: 'Open manhole',          category: 'Drainage/Sewage',         location: 'South Extension, Delhi',    lat: 28.5706, lng: 77.2152, status: 'UNDER_REVIEW' },
  { title: 'Waste dumping',         category: 'Waste Management',        location: 'MG Road, Bangalore',        lat: 12.9750, lng: 77.6081, status: 'ASSIGNED' },
  { title: 'Broken footpath',       category: 'Public Property Damage',  location: 'Whitefield, Bangalore',     lat: 12.9698, lng: 77.7500, status: 'RESOLVED' },
  { title: 'Water pipe leak',       category: 'Water Supply',            location: 'T. Nagar, Chennai',         lat: 13.0418, lng: 80.2341, status: 'SUBMITTED' },
  { title: 'Noise from factory',    category: 'Noise Pollution',         location: 'Park Street, Kolkata',      lat: 22.5553, lng: 88.3512, status: 'RESOLVED' },
  { title: 'Garbage on road',       category: 'Waste Management',        location: 'Koregaon Park, Pune',       lat: 18.5362, lng: 73.8942, status: 'SUBMITTED' },
];

/**
 * Returns the Firebase Auth UID for the given email.
 * Creates the account (with DEMO_PASSWORD) if it doesn't exist yet.
 */
async function getOrCreateAuthUser(email: string, displayName: string): Promise<string> {
  try {
    const existing = await fauth.getUserByEmail(email);
    // Keep demo accounts deterministic across reruns.
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

  let citizenUid = '';

  for (const user of demoUsers) {
    console.log(`Processing ${user.email} (${user.role})...`);

    // 1. Resolve the correct Firebase Auth UID — never hardcode
    const uid = await getOrCreateAuthUser(user.email, user.name);

    if (user.role === 'Citizen') citizenUid = uid;

    // 2. Write Firestore profile with the real UID
    await db.collection('users').doc(uid).set({
      uid,
      email: user.email,
      name: user.name,
      role: user.role,
      assignedZone: (user as any).assignedZone || '',
      zoneId: (user as any).zoneId || '',
      cityId: (user as any).cityId || '',
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

  // Seed demo complaints attached to the real citizen UID
  if (citizenUid) {
    console.log('Seeding demo complaints...');
    for (const complaint of demoComplaints) {
      await db.collection('complaints').add({
        ...complaint,
        citizenId: citizenUid,
        description: `Demo complaint: ${complaint.title} reported at ${complaint.location}`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    console.log(`✓ ${demoComplaints.length} demo complaints seeded.\n`);
  } else {
    console.warn('⚠️  No citizen UID resolved — skipping complaints.');
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
