import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const LOGO = path.join(ROOT, 'public', 'logo.png');
const RES_DIR = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');

// Android mipmap sizes for launcher icons
const DENSITIES = [
    { folder: 'mipmap-mdpi',    size: 48 },
    { folder: 'mipmap-hdpi',    size: 72 },
    { folder: 'mipmap-xhdpi',   size: 96 },
    { folder: 'mipmap-xxhdpi',  size: 144 },
    { folder: 'mipmap-xxxhdpi', size: 192 },
];

// Adaptive icon foreground size (108dp with padding)
const FOREGROUND_SIZES = [
    { folder: 'mipmap-mdpi',    size: 108 },
    { folder: 'mipmap-hdpi',    size: 162 },
    { folder: 'mipmap-xhdpi',   size: 216 },
    { folder: 'mipmap-xxhdpi',  size: 324 },
    { folder: 'mipmap-xxxhdpi', size: 432 },
];

async function generateIcons() {
    if (!fs.existsSync(LOGO)) {
        console.error('Error: public/logo.png not found!');
        process.exit(1);
    }

    console.log('Generating Android launcher icons with white background...');

    for (const { folder, size } of DENSITIES) {
        const dir = path.join(RES_DIR, folder);

        // ic_launcher.png - square icon with white background
        await sharp(LOGO)
            .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
            .flatten({ background: { r: 255, g: 255, b: 255 } })
            .png()
            .toFile(path.join(dir, 'ic_launcher.png'));
        console.log(`  ${folder}/ic_launcher.png (${size}x${size})`);

        // ic_launcher_round.png - same but will be masked by OS
        await sharp(LOGO)
            .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
            .flatten({ background: { r: 255, g: 255, b: 255 } })
            .png()
            .toFile(path.join(dir, 'ic_launcher_round.png'));
        console.log(`  ${folder}/ic_launcher_round.png (${size}x${size})`);
    }

    // Generate foreground images for adaptive icons
    for (const { folder, size } of FOREGROUND_SIZES) {
        const dir = path.join(RES_DIR, folder);
        const iconSize = Math.round(size * 0.6); // Logo takes ~60% of the 108dp canvas
        const padding = Math.round((size - iconSize) / 2);

        await sharp(LOGO)
            .resize(iconSize, iconSize, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
            .extend({
                top: padding,
                bottom: size - iconSize - padding,
                left: padding,
                right: size - iconSize - padding,
                background: { r: 255, g: 255, b: 255, alpha: 0 }
            })
            .png()
            .toFile(path.join(dir, 'ic_launcher_foreground.png'));
        console.log(`  ${folder}/ic_launcher_foreground.png (${size}x${size})`);
    }

    console.log('Done!');
}

generateIcons();
