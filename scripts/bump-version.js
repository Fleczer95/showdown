#!/usr/bin/env node

/**
 * Bump App Version
 *
 * Increments version numbers in app.json and package.json
 * Usage: node scripts/bump-version.js [major|minor|patch|prerelease] [--dry-run]
 *
 * Examples:
 *   node scripts/bump-version.js patch          # 0.1.0 -> 0.1.1
 *   node scripts/bump-version.js minor          # 0.1.0 -> 0.2.0
 *   node scripts/bump-version.js major          # 0.1.0 -> 1.0.0
 *   node scripts/bump-version.js patch --dry-run # Preview changes without applying
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.dirname(__dirname);
const APP_JSON_PATH = path.join(ROOT_DIR, 'app.json');
const PACKAGE_JSON_PATH = path.join(ROOT_DIR, 'package.json');
const IOS_INFO_PLIST_PATH = path.join(ROOT_DIR, 'ios/ShowDown/Info.plist');
const IOS_PBXPROJ_PATH = path.join(ROOT_DIR, 'ios/ShowDown.xcodeproj/project.pbxproj');

/**
 * Parse semver version string
 */
export function parseVersion(versionStr) {
    const match = versionStr.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
    if (!match) {
        throw new Error(`Invalid version format: ${versionStr}`);
    }

    return {
        major: parseInt(match[1], 10),
        minor: parseInt(match[2], 10),
        patch: parseInt(match[3], 10),
        prerelease: match[4] || null,
    };
}

/**
 * Format version object to string
 */
export function formatVersion(version) {
    const base = `${version.major}.${version.minor}.${version.patch}`;
    return version.prerelease ? `${base}-${version.prerelease}` : base;
}

/**
 * Increment version based on release type
 */
export function incrementVersion(version, type) {
    const newVersion = { ...version };

    switch (type) {
        case 'major':
            newVersion.major++;
            newVersion.minor = 0;
            newVersion.patch = 0;
            newVersion.prerelease = null;
            break;
        case 'minor':
            newVersion.minor++;
            newVersion.patch = 0;
            newVersion.prerelease = null;
            break;
        case 'patch':
            newVersion.patch++;
            newVersion.prerelease = null;
            break;
        case 'prerelease':
            newVersion.prerelease = `beta.${newVersion.patch + 1}`;
            break;
        default:
            throw new Error(`Invalid release type: ${type}. Use major, minor, patch, or prerelease`);
    }

    return newVersion;
}

/**
 * Update iOS Info.plist version fields using regex replacement
 */
function updateInfoPlist(filePath, versionStr, buildNumber) {
    let content = fs.readFileSync(filePath, 'utf-8');
    content = content.replace(
        /(<key>CFBundleShortVersionString<\/key>\s*<string>)[^<]*(<\/string>)/,
        `$1${versionStr}$2`,
    );
    content = content.replace(/(<key>CFBundleVersion<\/key>\s*<string>)[^<]*(<\/string>)/, `$1${buildNumber}$2`);
    fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * Update iOS project.pbxproj MARKETING_VERSION and CURRENT_PROJECT_VERSION
 */
function updatePbxproj(filePath, versionStr, buildNumber) {
    let content = fs.readFileSync(filePath, 'utf-8');
    content = content.replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${versionStr};`);
    content = content.replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${buildNumber};`);
    fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * Read and parse JSON file
 */
function readJSON(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
}

/**
 * Write JSON to file with proper formatting
 */
function writeJSON(filePath, data) {
    const content = JSON.stringify(data, null, 2) + '\n';
    fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * Main function
 */
function main() {
    const args = process.argv.slice(2);
    const releaseType = args[0] || 'patch';
    const dryRun = args.includes('--dry-run');

    if (!['major', 'minor', 'patch', 'prerelease'].includes(releaseType)) {
        console.error('❌ Invalid release type:', releaseType);
        console.error('Usage: node scripts/bump-version.js [major|minor|patch|prerelease] [--dry-run]');
        process.exit(1);
    }

    console.log(`📦 Bumping ${releaseType} version${dryRun ? ' (dry run)' : ''}\n`);

    // Read current versions
    const appJson = readJSON(APP_JSON_PATH);
    const packageJson = readJSON(PACKAGE_JSON_PATH);

    const currentAppVersion = appJson.expo.version;
    const currentPackageVersion = packageJson.version;
    const currentVersionCode = appJson.expo.android?.versionCode || 1;

    const iosPlistContent = fs.readFileSync(IOS_INFO_PLIST_PATH, 'utf-8');
    const iosPlistVersionMatch = iosPlistContent.match(
        /<key>CFBundleShortVersionString<\/key>\s*<string>([^<]*)<\/string>/,
    );
    const iosPlistBuildMatch = iosPlistContent.match(/<key>CFBundleVersion<\/key>\s*<string>([^<]*)<\/string>/);
    const currentIosVersion = iosPlistVersionMatch?.[1] ?? '?';
    const currentIosBuild = iosPlistBuildMatch?.[1] ?? '?';

    console.log('Current versions:');
    console.log(`  app.json version:        ${currentAppVersion}`);
    console.log(`  package.json version:    ${currentPackageVersion}`);
    console.log(`  Android versionCode:     ${currentVersionCode}`);
    console.log(`  iOS version (plist):     ${currentIosVersion}`);
    console.log(`  iOS build (plist):       ${currentIosBuild}\n`);

    // Calculate new versions
    const currentVersion = parseVersion(currentAppVersion);
    const newVersion = incrementVersion(currentVersion, releaseType);
    const newVersionStr = formatVersion(newVersion);
    const newVersionCode = currentVersionCode + 1;

    console.log('New versions:');
    console.log(`  app.json version:        ${newVersionStr}`);
    console.log(`  package.json version:    ${newVersionStr}`);
    console.log(`  Android versionCode:     ${newVersionCode}`);
    console.log(`  iOS version (plist):     ${newVersionStr}`);
    console.log(`  iOS build (plist):       ${newVersionCode}\n`);

    console.log('Changes:');
    console.log(`  📱 ${currentAppVersion} → ${newVersionStr} (${releaseType})`);
    console.log(`  🔢 Android versionCode: ${currentVersionCode} → ${newVersionCode} (+1)`);
    console.log(`  🍎 iOS version: ${currentIosVersion} → ${newVersionStr}`);
    console.log(`  🔢 iOS build: ${currentIosBuild} → ${newVersionCode}\n`);

    if (dryRun) {
        console.log('✅ Dry run complete. No files were modified.');
        return;
    }

    // Confirm
    console.log(
        '⚠️  This will modify app.json, package.json, ios/ShowDown/Info.plist, and ios/ShowDown.xcodeproj/project.pbxproj',
    );
    console.log('Press Ctrl+C to cancel, or wait 3 seconds to continue...\n');

    setTimeout(() => {
        // Update app.json
        appJson.expo.version = newVersionStr;
        if (appJson.expo.android) {
            appJson.expo.android.versionCode = newVersionCode;
        }

        // Update package.json
        packageJson.version = newVersionStr;

        // Write files
        writeJSON(APP_JSON_PATH, appJson);
        writeJSON(PACKAGE_JSON_PATH, packageJson);
        updateInfoPlist(IOS_INFO_PLIST_PATH, newVersionStr, newVersionCode);
        updatePbxproj(IOS_PBXPROJ_PATH, newVersionStr, newVersionCode);

        console.log('✅ Version updated successfully!\n');
        console.log('Updated files:');
        console.log('  - app.json');
        console.log('  - package.json');
        console.log('  - ios/ShowDown/Info.plist');
        console.log('  - ios/ShowDown.xcodeproj/project.pbxproj\n');
        console.log('Next steps:');
        console.log('  1. Review the changes with: git diff');
        console.log('  2. Build and test the new version');
        console.log(`  3. Commit: git commit -am "chore: bump version to ${newVersionStr}"`);
        console.log(`  4. Tag: git tag v${newVersionStr}`);
    }, 3000);
}

// Only run main if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
