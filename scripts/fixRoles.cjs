/**
 * Script to check and fix user roles in Firestore
 * Run with: node scripts/fixRoles.cjs
 */

const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function listAllUsers() {
  console.log('\n📋 Listing all users in Firestore:\n');
  
  const usersSnapshot = await db.collection('users').get();
  
  if (usersSnapshot.empty) {
    console.log('No users found in database.');
    return [];
  }
  
  const users = [];
  usersSnapshot.forEach(doc => {
    const data = doc.data();
    users.push({
      id: doc.id,
      email: data.email,
      name: data.name,
      role: data.role,
      roleType: typeof data.role
    });
  });
  
  console.log('ID\t\t\t\t\tEmail\t\t\t\tRole\t\tType');
  console.log('─'.repeat(100));
  
  users.forEach(u => {
    console.log(`${u.id.slice(0,20)}...\t${u.email?.padEnd(25) || 'N/A'.padEnd(25)}\t${String(u.role).padEnd(15)}\t${u.roleType}`);
  });
  
  return users;
}

async function fixRolesToLowercase() {
  console.log('\n🔧 Fixing roles to lowercase...\n');
  
  const usersSnapshot = await db.collection('users').get();
  let fixed = 0;
  
  for (const doc of usersSnapshot.docs) {
    const data = doc.data();
    const currentRole = data.role;
    
    if (currentRole && currentRole !== currentRole.toLowerCase()) {
      const newRole = currentRole.toLowerCase();
      await db.collection('users').doc(doc.id).update({ role: newRole });
      console.log(`✅ Fixed: ${data.email} - "${currentRole}" → "${newRole}"`);
      fixed++;
    }
  }
  
  if (fixed === 0) {
    console.log('All roles are already lowercase!');
  } else {
    console.log(`\n✅ Fixed ${fixed} user(s).`);
  }
}

async function setUserRole(email, newRole) {
  console.log(`\n🔧 Setting role for ${email} to "${newRole}"...\n`);
  
  const usersSnapshot = await db.collection('users').where('email', '==', email).get();
  
  if (usersSnapshot.empty) {
    console.log(`❌ User with email "${email}" not found.`);
    return;
  }
  
  const doc = usersSnapshot.docs[0];
  await db.collection('users').doc(doc.id).update({ role: newRole.toLowerCase() });
  console.log(`✅ Updated ${email} role to "${newRole.toLowerCase()}"`);
}

async function createUserDocument(uid, email, role, name = '') {
  console.log(`\n📝 Creating user document for UID: ${uid}...\n`);
  
  // Check if document already exists
  const existingDoc = await db.collection('users').doc(uid).get();
  if (existingDoc.exists) {
    console.log(`⚠️ Document already exists for UID: ${uid}`);
    console.log('   Existing data:', existingDoc.data());
    return;
  }
  
  // Create the user document
  const userData = {
    email: email,
    role: role.toLowerCase(),
    name: name || email.split('@')[0],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
  
  await db.collection('users').doc(uid).set(userData);
  console.log(`✅ Created user document:`);
  console.log(`   UID: ${uid}`);
  console.log(`   Email: ${email}`);
  console.log(`   Role: ${role.toLowerCase()}`);
  console.log(`   Name: ${userData.name}`);
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args[0] === 'list') {
    await listAllUsers();
  } else if (args[0] === 'fix') {
    await fixRolesToLowercase();
  } else if (args[0] === 'set' && args[1] && args[2]) {
    await setUserRole(args[1], args[2]);
  } else if (args[0] === 'create' && args[1] && args[2] && args[3]) {
    await createUserDocument(args[1], args[2], args[3], args[4]);
  } else {
    console.log('\nUsage:');
    console.log('  node scripts/fixRoles.cjs list                         - List all users');
    console.log('  node scripts/fixRoles.cjs fix                          - Fix all roles to lowercase');
    console.log('  node scripts/fixRoles.cjs set <email> <role>           - Set specific user role');
    console.log('  node scripts/fixRoles.cjs create <uid> <email> <role>  - Create user document');
    console.log('\nExample:');
    console.log('  node scripts/fixRoles.cjs set admin@test.com superadmin');
    console.log('  node scripts/fixRoles.cjs create abc123 admin@test.com superadmin');
    
    // Default: list users
    await listAllUsers();
  }
  
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
