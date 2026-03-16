const { Storage } = require('@google-cloud/storage');
const path = require('path');

// Try service account files
let keyFile = path.join(__dirname, 'service-account.json');
const fs = require('fs');
if (!fs.existsSync(keyFile)) {
  keyFile = path.join(__dirname, 'safaiconnect-86990953e826.json');
}

const storage = new Storage({ keyFilename: keyFile });
// Try both bucket name formats
const bucketNames = [
  'safaiconnect.firebasestorage.app',
  'safaiconnect.appspot.com',
];

async function setCors() {
  const corsConfig = [
    {
      origin: [
        'https://safai-pearl.vercel.app',
        'http://localhost:5173',
        'http://localhost:4173',
      ],
      method: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD'],
      maxAgeSeconds: 3600,
      responseHeader: [
        'Content-Type',
        'Authorization',
        'Content-Length',
        'X-Requested-With',
      ],
    },
  ];

  for (const bucketName of bucketNames) {
    try {
      console.log(`Trying bucket: ${bucketName}...`);
      await storage.bucket(bucketName).setCorsConfiguration(corsConfig);
      console.log(`CORS configuration set successfully on bucket: ${bucketName}`);

      // Verify
      const [metadata] = await storage.bucket(bucketName).getMetadata();
      console.log('Current CORS config:', JSON.stringify(metadata.cors, null, 2));
      return;
    } catch (err) {
      console.error(`  Failed for ${bucketName}: ${err.message}`);
    }
  }
  console.error('Could not set CORS on any bucket name. Check service account permissions.');
  process.exit(1);
}

setCors();
