const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccountPath = path.join(__dirname, 'service-account.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('service-account.json not found in scripts/.');
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: `${serviceAccount.project_id}.firebasestorage.app`,
});

const db = admin.firestore();
const auth = admin.auth();
const bucketCandidates = [
  `${serviceAccount.project_id}.firebasestorage.app`,
  `${serviceAccount.project_id}.appspot.com`,
];

async function deleteAllAuthUsers() {
  console.log('Deleting all Firebase Auth users...');
  let deleted = 0;
  let nextPageToken;

  do {
    const list = await auth.listUsers(1000, nextPageToken);
    const uids = list.users.map((u) => u.uid);
    if (uids.length) {
      await auth.deleteUsers(uids);
      deleted += uids.length;
      console.log(`  Deleted auth users so far: ${deleted}`);
    }
    nextPageToken = list.pageToken;
  } while (nextPageToken);

  console.log(`Auth cleanup complete. Total deleted: ${deleted}`);
}

async function deleteAllFirestoreData() {
  console.log('Deleting all Firestore collections...');
  const collections = await db.listCollections();

  for (const col of collections) {
    console.log(`  Deleting collection: ${col.id}`);
    await db.recursiveDelete(col);
  }

  console.log(`Firestore cleanup complete. Collections deleted: ${collections.length}`);
}

async function deleteAllStorageObjects() {
  console.log('Deleting all Firebase Storage objects...');
  for (const bucketName of bucketCandidates) {
    try {
      const bucket = admin.storage().bucket(bucketName);
      const [files] = await bucket.getFiles({ autoPaginate: true });
      if (!files.length) {
        console.log(`Storage cleanup complete for ${bucketName}. No objects found.`);
        return;
      }

      await Promise.all(files.map((file) => file.delete().catch(() => null)));
      console.log(`Storage cleanup complete for ${bucketName}. Objects processed: ${files.length}`);
      return;
    } catch (err) {
      // Try the next known bucket name.
    }
  }
  console.warn('Storage cleanup skipped: no accessible bucket found.');
}

async function main() {
  console.log('Starting full Firebase reset...');
  await deleteAllAuthUsers();
  await deleteAllFirestoreData();
  await deleteAllStorageObjects();
  console.log('Full Firebase reset complete.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Reset failed:', err);
  process.exit(1);
});
