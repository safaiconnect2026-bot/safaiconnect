const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

/**
 * Super Admin Initialization Script
 * ---------------------------------
 * This script uses the Firebase Admin SDK to assign the `SUPER_ADMIN` Custom Claim
 * to an existing Firebase Auth user, effectively making them the root administrator.
 * 
 * Pre-requisites:
 * 1. Generate a Service Account Key from your Firebase Console.
 *    (Project Settings > Service Accounts > Generate New Private Key)
 * 2. Save the downloaded JSON file as `service-account.json` in this same folder.
 * 3. Log into the app normally to create your desired admin account in Firebase Auth.
 * 4. Find the `uid` of that user in the Authentication tab of Firebase Console.
 * 
 * Usage:
 * node setSuperAdmin.cjs <user-uid>
 */

// 1. Path to your Service Account JSON file (do not commit this file to GitHub!)
const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'service-account.json');

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error('\n❌ Error: service-account.json not found!');
    console.error('Please download your Service Account Key from the Firebase Console and place it in the scripts/ folder as `service-account.json`.\n');
    process.exit(1);
}

// 2. Read the UID from command line arguments
const uid = process.argv[2];

if (!uid) {
    console.error('\n❌ Error: No UID provided.');
    console.error('Usage: node setSuperAdmin.cjs <user_uid>\n');
    process.exit(1);
}

// 3. Initialize Firebase Admin
const serviceAccount = require(SERVICE_ACCOUNT_PATH);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

// 4. Assign the Custom Claim and Firestore Document
async function makeSuperAdmin(targetUid) {
    try {
        console.log(`\n⏳ Attempting to promote user ${targetUid} to SUPER_ADMIN...`);

        // Verify user exists
        const user = await admin.auth().getUser(targetUid);

        // Set custom user claims
        await admin.auth().setCustomUserClaims(targetUid, { role: 'SUPER_ADMIN' });
        console.log(`✅ Success: Assigned 'SUPER_ADMIN' custom claim to ${user.email}.`);

        // Ensure they have a Firestore profile reflecting their role
        const db = admin.firestore();
        await db.collection('users').doc(targetUid).set({
            email: user.email,
            name: user.displayName || 'Primary Super Admin',
            role: 'SUPER_ADMIN',
            status: 'ACTIVE',
            isVerified: true,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true }); // use merge in case doc already exists

        console.log(`✅ Success: Updated Firestore profile for ${user.email}.`);
        console.log(`\n🎉 The user ${user.email} is now a Super Admin. They may need to log out and log back in to their account to refresh their token.\n`);

    } catch (error) {
        console.error('\n❌ Error setting claim:', error);
    } finally {
        process.exit(0);
    }
}

makeSuperAdmin(uid);
