import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const PUBLIC_DIR = path.join(process.cwd(), 'public');
const INPUT_IMAGE = path.join(PUBLIC_DIR, 'logo.png');

const SIZES = [
    { size: 192, name: 'pwa-192x192.png' },
    { size: 512, name: 'pwa-512x512.png' }
];

async function resizeIcons() {
    if (!fs.existsSync(INPUT_IMAGE)) {
        console.error('Error: public/logo.png not found!');
        process.exit(1);
    }

    console.log('Generating PWA icons from logo.png...');

    for (const { size, name } of SIZES) {
        const outputPath = path.join(PUBLIC_DIR, name);
        try {
            await sharp(INPUT_IMAGE)
                .resize(size, size, {
                    fit: 'contain',
                    background: { r: 255, g: 255, b: 255, alpha: 1 } // White background
                })
                .flatten({ background: { r: 255, g: 255, b: 255 } })
                .toFile(outputPath);
            console.log(`Created ${name} (${size}x${size})`);
        } catch (error) {
            console.error(`Failed to create ${name}:`, error);
        }
    }
}

resizeIcons();
