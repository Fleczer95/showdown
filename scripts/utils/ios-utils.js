#!/usr/bin/env node

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

export class IOSUtils {
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
        this.bundleIdentifier = 'com.fleczer.breathingapprn';
    }

    log(message, type = 'info') {
        const icons = {
            info: 'ℹ️',
            success: '✅',
            error: '❌',
            warning: '⚠️',
            progress: '🔄',
            start: '🚀',
        };
        console.log(`${icons[type]} ${message}`);
    }

    runCommand(command, description, options = {}) {
        const { silent = false, cwd = this.projectRoot } = options;

        try {
            if (!silent) {
                this.log(`${description}...`, 'progress');
            }
            execSync(command, {
                cwd,
                stdio: silent ? 'pipe' : 'inherit',
                encoding: 'utf8',
            });
            return true;
        } catch (error) {
            this.log(`Failed: ${description}`, 'error');
            return false;
        }
    }

    runCommandWithOutput(command, description, options = {}) {
        const { silent = false, cwd = this.projectRoot } = options;

        try {
            if (!silent) {
                this.log(`${description}...`, 'progress');
            }
            const output = execSync(command, {
                cwd,
                encoding: 'utf8',
                maxBuffer: 1024 * 1024, // 1MB buffer
            });
            return { success: true, output: output.trim() };
        } catch (error) {
            if (!silent) {
                this.log(`Failed: ${description}`, 'error');
            }
            return { success: false, output: error.stdout || '', error: error.stderr || '' };
        }
    }

    async checkSystemRequirements() {
        // Check if running on macOS
        if (process.platform !== 'darwin') {
            return {
                success: false,
                error: 'iOS testing requires macOS',
                platform: process.platform,
            };
        }

        // Check Xcode installation
        const xcrunCheck = this.runCommandWithOutput('which xcrun', 'Checking Xcode availability', { silent: true });
        if (!xcrunCheck.success) {
            return {
                success: false,
                error: 'Xcode not found - required for iOS development',
            };
        }

        return { success: true };
    }

    async getBootedSimulator() {
        const devicesResult = this.runCommandWithOutput('xcrun simctl list devices', 'Listing iOS devices', {
            silent: true,
        });
        if (!devicesResult.success) {
            return null;
        }

        const lines = devicesResult.output.split('\n');
        const bootedDevices = lines.filter((line) => line.includes('Booted') && line.includes('iPhone'));

        if (bootedDevices.length > 0) {
            return this.extractDeviceInfo(bootedDevices[0]);
        }

        return null;
    }

    async getAvailableSimulator() {
        const devicesResult = this.runCommandWithOutput('xcrun simctl list devices', 'Listing available iOS devices', {
            silent: true,
        });
        if (!devicesResult.success) {
            return null;
        }

        const lines = devicesResult.output.split('\n');
        const shutdownIPhones = lines.filter((line) => line.includes('iPhone') && line.includes('Shutdown'));

        if (shutdownIPhones.length > 0) {
            return this.extractDeviceInfo(shutdownIPhones[0]);
        }

        return null;
    }

    extractDeviceInfo(deviceLine) {
        const deviceId = deviceLine.match(/\(([A-F0-9\-]+)\)/)?.[1];
        const deviceName = deviceLine.match(/iPhone[^()]+/)?.[0]?.trim();
        return { id: deviceId, name: deviceName };
    }

    async startSimulator(deviceInfo) {
        if (!deviceInfo) {
            deviceInfo = await this.getAvailableSimulator();
            if (!deviceInfo) {
                this.log('No iPhone simulators found', 'error');
                return false;
            }
        }

        this.log(`Starting iOS simulator: ${deviceInfo.name}`, 'progress');

        // Boot the simulator
        const bootSuccess = this.runCommand(`xcrun simctl boot ${deviceInfo.id}`, 'Booting iOS simulator', {
            silent: true,
        });

        if (!bootSuccess) {
            return false;
        }

        // Open Simulator app
        this.runCommand('open -a Simulator', 'Opening Simulator app', { silent: true });

        return deviceInfo;
    }

    async ensureSimulator() {
        // Check if any simulators are already running
        let simulatorInfo = await this.getBootedSimulator();
        if (simulatorInfo) {
            return simulatorInfo;
        }

        // Start a new simulator
        return await this.startSimulator();
    }

    async waitForSimulator(deviceId, timeout = 60000) {
        const startTime = Date.now();
        const checkInterval = 2000;

        while (Date.now() - startTime < timeout) {
            await new Promise((resolve) => setTimeout(resolve, checkInterval));

            const checkResult = this.runCommandWithOutput('xcrun simctl list devices', 'Checking simulator status', {
                silent: true,
            });
            if (checkResult.success) {
                const deviceLines = checkResult.output.split('\n');
                const bootedDevice = deviceLines.find((line) => line.includes(deviceId) && line.includes('Booted'));

                if (bootedDevice) {
                    return true;
                }
            }
        }

        return false;
    }

    findBuiltApp() {
        const findAppResult = this.runCommandWithOutput(
            'find ~/Library/Developer/Xcode/DerivedData/breathingapprn-*/Build/Products/Debug-iphonesimulator/breathingapprn.app -name "breathingapprn.app" 2>/dev/null | head -1',
            'Finding built iOS app',
            { silent: true },
        );

        if (findAppResult.success && findAppResult.output) {
            return findAppResult.output.trim();
        }

        return null;
    }

    async installApp(appPath, deviceId) {
        return this.runCommand(`xcrun simctl install ${deviceId} "${appPath}"`, 'Installing iOS app', { silent: true });
    }

    async launchApp(deviceId) {
        // Terminate the app first (if running)
        this.runCommand(`xcrun simctl terminate ${deviceId} ${this.bundleIdentifier}`, 'Terminating iOS app', {
            silent: true,
        });

        // Launch app
        return this.runCommand(`xcrun simctl launch ${deviceId} ${this.bundleIdentifier}`, 'Launching iOS app', {
            silent: true,
        });
    }

    async isAppInstalled(deviceId) {
        const installedCheck = this.runCommandWithOutput(
            `xcrun simctl listapps ${deviceId} | grep -i "${this.bundleIdentifier}"`,
            'Checking if iOS app is installed',
            { silent: true },
        );

        return installedCheck.success && installedCheck.output;
    }
}

export default IOSUtils;
