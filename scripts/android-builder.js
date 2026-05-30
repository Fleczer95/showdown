#!/usr/bin/env node

import path from 'path';
import { fileURLToPath } from 'url';
// import { TestUtils } from '../e2e/maestro/scripts/utils/test-utils.js';
// import { AndroidHandler } from '../e2e/maestro/scripts/platform-handlers/android-handler.js';
import { DeviceManager } from './utils/device-manager.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class AndroidBuilder {
    constructor() {
        this.projectRoot = path.join(__dirname, '..');
        // this.testUtils = new TestUtils(this.projectRoot);
        // this.androidHandler = new AndroidHandler(this.testUtils);
        this.deviceManager = new DeviceManager(this.projectRoot);
    }

    async buildApk() {
        this.testUtils.log('🔨 Building Android APK...', 'start');

        // Ensure cache directories exist
        await this.testUtils.ensureCacheDirectories();

        // Check if we have a cached app
        const cachedAppPath = await this.testUtils.getCachedAppPath('android');
        if (cachedAppPath) {
            this.testUtils.log('✅ Using cached APK', 'success');
            return cachedAppPath;
        }

        // Build the app using the Android handler's build logic
        const appPath = await this.androidHandler.buildApp();
        if (!appPath) {
            this.testUtils.log('❌ Failed to build APK', 'error');
            return null;
        }

        this.testUtils.log('✅ APK built successfully', 'success');
        return appPath;
    }

    async startEmulator() {
        this.testUtils.log('📱 Starting Android emulator...', 'start');

        // Use centralized device management
        const deviceInfo = await this.deviceManager.checkAndroidDeviceAvailability();

        if (deviceInfo.available) {
            this.testUtils.log('✅ Android device is already available', 'success');
            return true;
        }

        // Fall back to AndroidHandler for emulator startup
        const emulatorReady = await this.androidHandler.ensureEmulator();
        if (!emulatorReady) {
            this.testUtils.log('❌ Failed to start emulator', 'error');
            return false;
        }

        // Verify device is ready after startup
        const deviceInfoAfter = await this.deviceManager.checkAndroidDeviceAvailability();
        if (!deviceInfoAfter.available) {
            this.testUtils.log('❌ Emulator started but device not available', 'error');
            return false;
        }

        // Wait for device to be fully ready
        const isReady = await this.deviceManager.waitForAndroidDeviceReady(deviceInfoAfter.adbCmd);
        if (!isReady) {
            this.testUtils.log('❌ Device did not become ready', 'warning');
            // Continue anyway as device might be partially ready
        }

        this.testUtils.log('✅ Emulator is running and ready', 'success');
        return true;
    }

    async installAndRunApp(appPath) {
        this.testUtils.log('📲 Installing and running Android app...', 'start');

        const success = await this.androidHandler.installAndRunApp(appPath);
        if (!success) {
            this.testUtils.log('❌ Failed to install/run app', 'error');
            return false;
        }

        this.testUtils.log('✅ App installed and running', 'success');
        return true;
    }

    async buildAndRun() {
        this.testUtils.log('🚀 Starting Android build and run process...', 'start');
        this.testUtils.log('==========================================', 'info');

        // Step 1: Start emulator
        const emulatorStarted = await this.startEmulator();
        if (!emulatorStarted) {
            return false;
        }

        // Step 2: Build APK
        const appPath = await this.buildApk();
        if (!appPath) {
            return false;
        }

        // Step 3: Install and run app
        const appRunning = await this.installAndRunApp(appPath);
        if (!appRunning) {
            return false;
        }

        this.testUtils.log('🎉 Android app is now running on emulator!', 'success');
        this.testUtils.log(`📍 APK path: ${appPath}`, 'info');
        return true;
    }

    async clearCache() {
        await this.testUtils.clearCache();
    }

    async showCacheInfo() {
        await this.testUtils.showCacheInfo();
    }
}

async function main() {
    const builder = new AndroidBuilder();
    const args = process.argv.slice(2);

    if (args.length === 0 || args[0] === 'help') {
        console.log(`
🔨 Android Build & Emulator Manager

USAGE:
  node scripts/android-builder.js <command>

COMMANDS:
  build                 Build APK only (with caching)
  emulator              Start emulator only
  install               Build APK and install on emulator
  run                   Full build and run process (default)
  clear-cache           Clear build cache
  cache-info            Show cache information
  help                  Show this help message

FEATURES:
  💾 Build caching - Skips rebuild when source hasn't changed
  📱 Smart emulator management - Auto-starts if needed
  🔄 App installation reuse - Keeps app installed between runs
  ⚡ Source code hashing - Accurate change detection

EXAMPLES:
  node scripts/android-builder.js run           # Full build and run
  node scripts/android-builder.js build         # Build APK only
  node scripts/android-builder.js emulator      # Start emulator only
  node scripts/android-builder.js clear-cache   # Clear build cache
`);
        return;
    }

    const command = args[0];

    console.log('🔨 Android Build & Emulator Manager');
    console.log('=====================================\n');

    switch (command) {
        case 'build':
            await builder.buildApk();
            break;

        case 'emulator':
            await builder.startEmulator();
            break;

        case 'install':
            const appPath = await builder.buildApk();
            if (appPath) {
                await builder.installAndRunApp(appPath);
            }
            break;

        case 'run':
            await builder.buildAndRun();
            break;

        case 'clear-cache':
            await builder.clearCache();
            break;

        case 'cache-info':
            await builder.showCacheInfo();
            break;

        default:
            builder.testUtils.log(`Unknown command: ${command}`, 'error');
            builder.testUtils.log('Use "help" to see available commands', 'info');
            process.exit(1);
    }
}

main().catch((error) => {
    console.error('❌ Android Builder failed:', error.message);
    process.exit(1);
});
