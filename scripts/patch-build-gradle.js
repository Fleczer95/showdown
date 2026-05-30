#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.dirname(__dirname);

const buildGradlePath = path.join(projectRoot, 'android/app/build.gradle');

console.log('🔧 Patching android/app/build.gradle...');

try {
    if (!existsSync(buildGradlePath)) {
        console.log('⏭️  Skipping Android patch: build.gradle not found');
        process.exit(0);
    }

    let content = readFileSync(buildGradlePath, 'utf8');
    let modified = false;

    // 1. Add signing config (if not already present)
    if (!content.includes('MYAPP_UPLOAD_STORE_FILE')) {
        const namespaceMatch = content.match(/(namespace '[^']+'\n)/);
        if (namespaceMatch) {
            const signingConfig = `    def keystorePropertiesFile = rootProject.file("local.properties")
    def keystoreProperties = new Properties()
    if (keystorePropertiesFile.exists()) {
        keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
    }

    signingConfigs {
        release {
            if (keystoreProperties['MYAPP_UPLOAD_STORE_FILE']) {
                storeFile rootProject.file(keystoreProperties['MYAPP_UPLOAD_STORE_FILE'])
                storePassword keystoreProperties['MYAPP_UPLOAD_STORE_PASSWORD']
                keyAlias keystoreProperties['MYAPP_UPLOAD_KEY_ALIAS']
                keyPassword keystoreProperties['MYAPP_UPLOAD_KEY_PASSWORD']
            } else {
                // Fallback to debug signing if release keystore not configured
                storeFile file('debug.keystore')
                storePassword 'android'
                keyAlias 'androiddebugkey'
                keyPassword 'android'
            }
        }
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
`;
            content = content.replace(namespaceMatch[0], namespaceMatch[1] + signingConfig);
            modified = true;
        }
    }

    // 2. Update release signing config (if using debug signing)
    // Also check if signingConfigs block needs to be completed

    // First, remove duplicate signingConfigs blocks (Expo prebuild sometimes adds extras)
    const signingConfigsCount = (content.match(/signingConfigs\s*\{/g) || []).length;
    if (signingConfigsCount > 1) {
        // Find and remove the second signingConfigs block (the one Expo adds)
        // Expo's duplicate is usually a simple debug-only block after defaultConfig
        const lines = content.split('\n');
        let firstSigningConfigsIndex = -1;
        let inSecondSigningConfigs = false;
        let secondSigningConfigsStart = -1;
        let secondSigningConfigsEnd = -1;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes('signingConfigs {')) {
                if (firstSigningConfigsIndex === -1) {
                    firstSigningConfigsIndex = i;
                } else {
                    // Found second signingConfigs block
                    secondSigningConfigsStart = i;
                    // Find the end of this block (count braces)
                    let braceCount = 0;
                    for (let j = i; j < lines.length; j++) {
                        if (lines[j].includes('{')) braceCount++;
                        if (lines[j].includes('}')) braceCount--;
                        if (braceCount === 0) {
                            secondSigningConfigsEnd = j;
                            break;
                        }
                    }
                    break;
                }
            }
        }

        if (secondSigningConfigsStart !== -1 && secondSigningConfigsEnd !== -1) {
            // Remove the duplicate block itself (from signingConfigs { to closing })
            lines.splice(secondSigningConfigsStart, secondSigningConfigsEnd - secondSigningConfigsStart + 1);
            content = lines.join('\n');
            modified = true;
            console.log('   ℹ️  Removed duplicate signingConfigs block');
        }
    }

    if (content.match(/buildTypes[\s\S]*?release\s*\{[\s\S]*?signingConfig\s+signingConfigs\.debug/im)) {
        // Fix release build type to use release signing config instead of debug
        content = content.replace(
            /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?signingConfig\s+)signingConfigs\.debug/im,
            '$1signingConfigs.release',
        );
        modified = true;
        console.log('   ℹ️  Updated release signing to use signingConfigs.release');
    } else if (!content.includes('debug {') && content.includes('signingConfigs')) {
        // Complete the signingConfigs block
        content = content.replace(
            /signingConfigs \{\s*release \{[^}]*\}\s*\}\s*packagingOptions/s,
            `signingConfigs {
        release {
            if (keystoreProperties['MYAPP_UPLOAD_STORE_FILE']) {
                storeFile rootProject.file(keystoreProperties['MYAPP_UPLOAD_STORE_FILE'])
                storePassword keystoreProperties['MYAPP_UPLOAD_STORE_PASSWORD']
                keyAlias keystoreProperties['MYAPP_UPLOAD_KEY_ALIAS']
                keyPassword keystoreProperties['MYAPP_UPLOAD_KEY_PASSWORD']
            } else {
                // Fallback to debug signing if release keystore not configured
                storeFile file('debug.keystore')
                storePassword 'android'
                keyAlias 'androiddebugkey'
                keyPassword 'android'
            }
        }
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Use upload keystore for Play Store releases
            signingConfig signingConfigs.release
            def enableShrinkResources = findProperty('android.enableShrinkResourcesInReleaseBuilds') ?: 'false'
            shrinkResources enableShrinkResources.toBoolean()
            minifyEnabled enableMinifyInReleaseBuilds
            proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
            def enablePngCrunchInRelease = findProperty('android.enablePngCrunchInReleaseBuilds') ?: 'true'
            crunchPngs enablePngCrunchInRelease.toBoolean()
        }
    }
    packagingOptions`,
        );
        modified = true;
    } else if (!content.includes('buildTypes {')) {
        // Add buildTypes block if it's missing
        content = content.replace(
            /signingConfigs \{[^}]*\}/,
            `signingConfigs {
        release {
            if (keystoreProperties['MYAPP_UPLOAD_STORE_FILE']) {
                storeFile rootProject.file(keystoreProperties['MYAPP_UPLOAD_STORE_FILE'])
                storePassword keystoreProperties['MYAPP_UPLOAD_STORE_PASSWORD']
                keyAlias keystoreProperties['MYAPP_UPLOAD_KEY_ALIAS']
                keyPassword keystoreProperties['MYAPP_UPLOAD_KEY_PASSWORD']
            } else {
                // Fallback to debug signing if release keystore not configured
                storeFile file('debug.keystore')
                storePassword 'android'
                keyAlias 'androiddebugkey'
                keyPassword 'android'
            }
        }
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Use upload keystore for Play Store releases
            signingConfig signingConfigs.release
            def enableShrinkResources = findProperty('android.enableShrinkResourcesInReleaseBuilds') ?: 'false'
            shrinkResources enableShrinkResources.toBoolean()
            minifyEnabled enableMinifyInReleaseBuilds
            proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
            def enablePngCrunchInRelease = findProperty('android.enablePngCrunchInReleaseBuilds') ?: 'true'
            crunchPngs enablePngCrunchInRelease.toBoolean()
        }
    }`,
        );
        modified = true;
    }

    // 3. (Optional) Add other patches here

    if (modified) {
        writeFileSync(buildGradlePath, content, 'utf8');
        console.log('✅ Successfully patched build.gradle');
        console.log('   - Added keystore loading from local.properties');
        console.log('   - Configured release signing');
    } else {
        console.log('✅ build.gradle already patched');
    }
} catch (error) {
    console.error('❌ Failed to patch build.gradle:', error.message);
    process.exit(1);
}
