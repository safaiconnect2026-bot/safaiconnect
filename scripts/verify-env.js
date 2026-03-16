import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('--- Environment Verification ---');

function checkCommand(command, name) {
    try {
        execSync(command, { stdio: 'ignore' });
        console.log(`✅ ${name} is installed.`);
        return true;
    } catch (e) {
        console.log(`❌ ${name} is NOT found or NOT in PATH.`);
        return false;
    }
}

// Check Node.js
console.log(`Node.js Version: ${process.version}`);

// Check Java
if (checkCommand('java -version', 'Java')) {
    try {
        const javaHome = process.env.JAVA_HOME || 'Not Set';
        console.log(`JAVA_HOME: ${javaHome}`);
    } catch (e) { }
}

// Check Android SDK
const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || 'Not Set';
console.log(`ANDROID_HOME: ${androidHome}`);

// Check Capacitor
checkCommand('npx cap --version', 'Capacitor CLI');

// Check Firebase Config
const androidFirebasePath = path.join(process.cwd(), 'android', 'app', 'google-services.json');
if (fs.existsSync(androidFirebasePath)) {
    console.log('✅ google-services.json found in android/app/');
} else {
    console.log('⚠️ google-services.json NOT found in android/app/');
}

console.log('-------------------------------');
