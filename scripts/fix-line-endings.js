#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

// Get scripts to fix from command line args
const scripts = process.argv.slice(2);

if (scripts.length === 0) {
    console.log('Usage: node scripts/fix-line-endings.js <script1> <script2> ...');
    process.exit(1);
}

let fixedCount = 0;

scripts.forEach((scriptPath) => {
    const fullPath = path.join(process.cwd(), scriptPath);

    if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        if (content !== normalized) {
            fs.writeFileSync(fullPath, normalized, 'utf8');
            console.log(`✅ Fixed line endings for: ${scriptPath}`);
            fixedCount++;
        }

        // Make executable
        try {
            fs.chmodSync(fullPath, '755');
        } catch (error) {
            // Ignore permission errors on Windows
        }
    }
});

if (fixedCount > 0) {
    console.log(`🔧 Fixed ${fixedCount} script(s)`);
}
