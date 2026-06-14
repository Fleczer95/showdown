#!/usr/bin/env node

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class DeviceManager {
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
        this.androidPaths = [
            'adb', // System PATH
            '$HOME/Android/platform-tools/adb', // Android Studio default
            '$HOME/Library/Android/sdk/platform-tools/adb', // macOS
            '/usr/local/android-sdk/platform-tools/adb', // Linux
        ];
    }

    log(message, type = 'info') {
        const icons = {
            info: '📋',
            success: '✅',
            error: '❌',
            warning: '⚠️',
            start: '🚀',
            progress: '⏳',
        };
        console.log(`${icons[type]} ${message}`);
    }

    async runCommandWithOutput(command, description, cwd = this.projectRoot) {
        this.log(description, 'progress');
        try {
            const result = execSync(command, { cwd, encoding: 'utf8', stdio: 'pipe' });
            this.log(`${description} completed`, 'success');
            return { success: true, output: result.trim() };
        } catch (error) {
            this.log(`${description} failed: ${error.message}`, 'error');
            return { success: false, output: error.stdout?.trim() || '', error: error.message };
        }
    }

    async runCommand(command, description, cwd = this.projectRoot, silent = false) {
        this.log(description, 'progress');
        try {
            const options = { cwd, stdio: silent ? 'pipe' : 'inherit' };
            execSync(command, options);
            this.log(`${description} completed`, 'success');
            return true;
        } catch (error) {
            this.log(`${description} failed: ${error.message}`, 'error');
            return false;
        }
    }

    /**
     * Find ADB executable from multiple possible paths
     */
    async findAdbCommand() {
        this.log('Looking for ADB...', 'progress');

        // Try each possible ADB path
        for (const adbPath of this.androidPaths) {
            const expandedPath = adbPath.replace('$HOME', process.env.HOME || '');

            if (adbPath === 'adb') {
                // Check system PATH first
                const result = await this.runCommandWithOutput('which adb', 'Checking ADB in PATH');
                if (result.success) {
                    this.log(`Found ADB in PATH: ${result.output}`, 'success');
                    return 'adb';
                }
            } else {
                // Check specific paths
                const result = await this.runCommandWithOutput(
                    `ls "${expandedPath}"`,
                    `Checking ADB at ${expandedPath}`,
                );
                if (result.success) {
                    this.log(`Found ADB at: ${expandedPath}`, 'success');
                    return expandedPath;
                }
            }
        }

        this.log('ADB not found in any standard location', 'error');
        return null;
    }

    /**
     * Check if Android device/emulator is available
     */
    async checkAndroidDeviceAvailability() {
        this.log('📱 Checking for Android devices...', 'progress');

        const adbCmd = await this.findAdbCommand();
        if (!adbCmd) {
            this.log('❌ ADB not found. Please install Android SDK or Android Studio', 'error');
            return { available: false, adbCmd: null };
        }

        const devicesResult = await this.runCommandWithOutput(`${adbCmd} devices`, 'Listing connected devices');

        if (!devicesResult.success) {
            this.log('❌ Failed to run ADB devices command', 'error');
            return { available: false, adbCmd, error: 'ADB command failed' };
        }

        const lines = devicesResult.output.split('\n');
        const deviceLines = lines.filter((line) => line.includes('\tdevice') || line.includes('\temulator'));

        if (deviceLines.length === 0) {
            this.log('❌ No Android devices or emulators found', 'error');
            this.log('Please ensure:', 'info');
            this.log('1. Android emulator is running', 'info');
            this.log('2. Or Android device is connected via USB', 'info');
            this.log('', 'info');
            this.log('Current devices:', 'info');
            console.log(devicesResult.output);
            return { available: false, adbCmd, error: 'No devices found' };
        }

        this.log(`✅ Found ${deviceLines.length} Android device(s) connected`, 'success');
        const devices = deviceLines.map((line) => {
            const deviceId = line.split('\t')[0];
            const deviceType = line.includes('\temulator') ? 'emulator' : 'device';
            return { id: deviceId, type: deviceType };
        });

        devices.forEach((device) => {
            this.log(`  - ${device.type}: ${device.id}`, 'info');
        });

        return { available: true, adbCmd, devices };
    }

    /**
     * Check if iOS simulator is available (macOS only)
     */
    async checkIosDeviceAvailability() {
        this.log('📱 Checking for iOS devices...', 'progress');

        if (process.platform !== 'darwin') {
            this.log('❌ iOS testing is only available on macOS', 'error');
            return { available: false, error: 'macOS required' };
        }

        // Check if xcrun is available
        const xcrunResult = await this.runCommandWithOutput('which xcrun', 'Checking Xcode availability');
        if (!xcrunResult.success) {
            this.log('❌ Xcode not found! Please install Xcode from Mac App Store', 'error');
            return { available: false, error: 'Xcode not found' };
        }

        // Check for booted simulators
        const simulatorsResult = await this.runCommandWithOutput(
            'xcrun simctl list devices | grep -E "iPhone.*Booted|iPad.*Booted"',
            'Checking for booted iOS simulators',
        );

        if (!simulatorsResult.success || simulatorsResult.output.trim() === '') {
            this.log('❌ No iOS simulator found!', 'error');
            this.log('Please ensure:', 'info');
            this.log('1. Xcode is installed', 'info');
            this.log('2. iOS simulator is running (Xcode > Open Developer Tool > Simulator)', 'info');
            this.log('3. Or use: xcrun simctl boot "iPhone 16e"', 'info');
            this.log('', 'info');

            // Show available simulators
            const availableResult = await this.runCommandWithOutput(
                'xcrun simctl list devices | grep iPhone',
                'Listing available iPhone simulators',
            );
            if (availableResult.success) {
                this.log('Available devices:', 'info');
                console.log(availableResult.output);
            }

            return { available: false, error: 'No simulators booted' };
        }

        this.log('✅ iOS simulator found', 'success');
        console.log(simulatorsResult.output);

        return { available: true, simulators: simulatorsResult.output };
    }

    /**
     * Wait for Android device to be fully ready
     */
    async waitForAndroidDeviceReady(adbCmd, maxWaitTime = 30000) {
        this.log('⏳ Waiting for Android device to be fully ready...', 'progress');
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitTime) {
            // Check if device is still connected
            const devicesResult = await this.runCommandWithOutput(
                `${adbCmd} devices`,
                'Checking device status',
                this.projectRoot,
            );

            if (devicesResult.success) {
                const lines = devicesResult.output.split('\n');
                const deviceLines = lines.filter((line) => line.includes('\tdevice'));

                if (deviceLines.length > 0) {
                    // Additional check: verify Android system is fully booted
                    const bootCompleted = await this.runCommandWithOutput(
                        `${adbCmd} shell getprop sys.boot_completed`,
                        'Checking if Android boot completed',
                        this.projectRoot,
                    );

                    if (bootCompleted.success && bootCompleted.output.trim() === '1') {
                        this.log('✅ Android device is ready', 'success');
                        return true;
                    }
                }
            }

            await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        this.log('❌ Android device failed to become ready within timeout period', 'error');
        return false;
    }

    /**
     * Get device availability info for multiple platforms
     */
    async getDeviceAvailability(platforms = ['android', 'ios']) {
        const results = {};

        if (platforms.includes('android')) {
            results.android = await this.checkAndroidDeviceAvailability();
        }

        if (platforms.includes('ios')) {
            results.ios = await this.checkIosDeviceAvailability();
        }

        return results;
    }

    /**
     * Validate devices are ready for testing
     */
    async validateDevicesForTesting(platforms = ['android']) {
        const availability = await this.getDeviceAvailability(platforms);
        const readyDevices = {};
        const errors = [];

        for (const [platform, info] of Object.entries(availability)) {
            if (info.available) {
                if (platform === 'android' && info.adbCmd) {
                    const isReady = await this.waitForAndroidDeviceReady(info.adbCmd);
                    if (isReady) {
                        readyDevices[platform] = info;
                    } else {
                        errors.push(`${platform}: Device not ready`);
                    }
                } else if (platform === 'ios') {
                    readyDevices[platform] = info;
                }
            } else {
                errors.push(`${platform}: ${info.error || 'Not available'}`);
            }
        }

        return {
            readyDevices,
            errors,
            hasDevices: Object.keys(readyDevices).length > 0,
        };
    }
}

// CLI interface for standalone usage
if (import.meta.url === `file://${process.argv[1]}`) {
    const deviceManager = new DeviceManager(process.cwd());
    const args = process.argv.slice(2);
    const platform = args[0] || 'both';

    console.log('🔧 Device Manager');
    console.log('==================\n');

    deviceManager
        .getDeviceAvailability(platform === 'both' ? ['android', 'ios'] : [platform])
        .then((results) => {
            console.log('Device Availability Results:');
            console.log('============================');

            for (const [platform, info] of Object.entries(results)) {
                console.log(`\n${platform.toUpperCase()}:`);
                console.log(`  Available: ${info.available ? '✅' : '❌'}`);
                if (info.available) {
                    if (platform === 'android') {
                        console.log(`  ADB Command: ${info.adbCmd}`);
                        console.log(`  Devices: ${info.devices?.length || 0}`);
                    } else if (platform === 'ios') {
                        console.log(`  Simulators: Available`);
                    }
                } else {
                    console.log(`  Error: ${info.error || 'Unknown error'}`);
                }
            }
        })
        .catch((error) => {
            console.error('❌ Device Manager failed:', error.message);
            process.exit(1);
        });
}
