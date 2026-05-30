#!/usr/bin/env node

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { symlinkSync, existsSync } from 'fs';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.dirname(__dirname);

console.log('🚀 Starting prebuild process...');

// Function to create symlinks for critical files that should not be in android directory
const createAndroidSymlinks = () => {
    console.log('📱 Creating symlinks for Android build files...');

    const filesToLink = [
        { source: 'local.properties', target: 'android/local.properties' },
        { source: 'showdown-upload-key.keystore', target: 'android/showdown-upload-key.keystore' },
    ];

    for (const { source, target } of filesToLink) {
        const sourcePath = path.join(projectRoot, source);
        const targetPath = path.join(projectRoot, target);

        if (!existsSync(sourcePath)) {
            console.log(`   ℹ️  Source file ${source} not found, skipping symlink.`);
            continue;
        }

        try {
            // Remove existing file/link if it exists
            if (existsSync(targetPath)) {
                fs.unlinkSync(targetPath);
                console.log(`   🗑️  Removed existing: ${target}`);
            }

            // Create symlink
            symlinkSync(sourcePath, targetPath);
            console.log(`   ✅ Created symlink: ${source} -> ${target}`);
        } catch (error) {
            console.warn(`   ⚠️  Warning: Could not create symlink for ${source}: ${error.message}`);
        }
    }

    console.log('✅ Android symlinks completed');
};

// Define all prebuild tasks in order
const prebuildTasks = [
    {
        name: 'Create Android Symlinks',
        command: createAndroidSymlinks,
        description: 'Create symlinks for critical Android files (keystore, local.properties)',
        isFunction: true,
    },
    {
        name: 'Patch Build Config',
        command: `node "${path.join(__dirname, 'patch-build-gradle.js')}"`,
        description: 'Restore custom build.gradle changes (signing config, etc.)',
    },
];

const runPrebuild = async () => {
    const startTime = Date.now();
    let failedTasks = [];

    for (const task of prebuildTasks) {
        try {
            console.log(`\n📋 Running: ${task.name}`);
            console.log(`   ${task.description}`);

            if (task.isFunction) {
                // Execute function directly
                await task.command();
            } else {
                // Execute command
                execSync(task.command, { stdio: 'inherit' });
            }

            console.log(`✅ Completed: ${task.name}`);
        } catch (error) {
            console.error(`❌ Failed: ${task.name}`);
            console.error(`   Error: ${error.message}`);
            failedTasks.push(task.name);
        }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    if (failedTasks.length > 0) {
        console.log(`\n❌ Prebuild completed with errors in ${duration}s`);
        console.log(`Failed tasks: ${failedTasks.join(', ')}`);
        process.exit(1);
    } else {
        console.log(`\n✅ All prebuild tasks completed successfully in ${duration}s`);
        console.log(`Total tasks executed: ${prebuildTasks.length}`);
    }
};

// Run prebuild
runPrebuild().catch((error) => {
    console.error('💥 Prebuild process failed:', error);
    process.exit(1);
});
