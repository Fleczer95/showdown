#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get project root directory
const projectRoot = path.join(__dirname, '..');

// Paths to scan
const sourceDirectories = ['src'];
const ignoreDirectories = ['node_modules', '.git', 'dist', 'build', '.expo', 'ios', 'android'];
const ignoreFiles = ['.test.', '.spec.', '.stories.'];

// Translation directory
const localesDir = path.join(projectRoot, 'src/i18n/locales');

/**
 * Recursively get all nested keys from an object as dot-separated paths
 */
function getAllTranslationKeys(obj, prefix = '') {
    const keys = [];

    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const fullKey = prefix ? `${prefix}.${key}` : key;

            if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                // Recursively get keys from nested objects
                keys.push(...getAllTranslationKeys(obj[key], fullKey));
            } else {
                // Add the key path
                keys.push(fullKey);
            }
        }
    }

    return keys;
}

/**
 * Get value from nested object using dot-separated path
 */
function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
        return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
}

/**
 * Check if a value is empty
 */
function isEmptyValue(value) {
    return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}

/**
 * Get all translation files from locales directory
 */
function getTranslationFiles() {
    if (!fs.existsSync(localesDir)) {
        console.error(`❌ Locales directory not found: ${localesDir}`);
        process.exit(1);
    }

    return fs
        .readdirSync(localesDir)
        .filter((file) => file.endsWith('.json'))
        .map((file) => ({
            locale: path.basename(file, '.json'),
            filePath: path.join(localesDir, file),
            fileName: file,
        }))
        .sort((a, b) => {
            if (a.locale === 'en') return -1;
            if (b.locale === 'en') return 1;
            return a.locale.localeCompare(b.locale);
        });
}

/**
 * Get all files to scan for translation usage
 */
function getSourceFiles(dir, files = []) {
    const items = fs.readdirSync(dir);

    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            if (ignoreDirectories.includes(item)) continue;
            getSourceFiles(fullPath, files);
        } else if (stat.isFile()) {
            const ext = path.extname(item);
            if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
                if (!ignoreFiles.some((pattern) => item.includes(pattern))) {
                    files.push(fullPath);
                }
            }
        }
    }

    return files;
}

/**
 * Extract translation keys from source code
 */
function extractUsedKeysFromCode(code) {
    const usedKeys = new Set();
    const dynamicKeyPatterns = new Set();

    // Pattern 1: translate('key') or t('key')
    const patterns = [
        /\btranslate\s*\(\s*['"`]([^'"`]+)['"`]/g,
        /\bt\s*\(\s*['"`]([^'"`]+)['"`]/g,
        /labelKey:\s*['"`]([^'"`]+)['"`]/g,
        /titleKey:\s*['"`]([^'"`]+)['"`]/g,
        /descriptionKey:\s*['"`]([^'"`]+)['"`]/g,
    ];

    patterns.forEach((pattern) => {
        let match;
        while ((match = pattern.exec(code)) !== null) {
            // Template-literal keys containing interpolation are checked by the
            // dynamic-pattern pass below, not as impossible literal locale keys.
            if (!match[1].includes('${')) usedKeys.add(match[1]);
        }
    });

    // Pattern 2: Template literals with variables (dynamic keys)
    // Matches: `screen.${variable}` or `game.${id}.name`
    const dynamicPattern = /`([^`]*\$\{[^}]+\}[^`]*)`/g;
    let match;
    while ((match = dynamicPattern.exec(code)) !== null) {
        dynamicKeyPatterns.add(match[1]);
    }

    return { usedKeys, dynamicKeyPatterns };
}

function analyze() {
    console.log('🔍 Analyzing ShowDown Translations...\n');

    const translationFiles = getTranslationFiles();
    const translations = {};
    const keysByLocale = {};

    for (const file of translationFiles) {
        const content = fs.readFileSync(file.filePath, 'utf8');
        translations[file.locale] = JSON.parse(content);
        keysByLocale[file.locale] = getAllTranslationKeys(translations[file.locale]);
        console.log(`📖 ${file.fileName}: ${keysByLocale[file.locale].length} keys`);
    }

    const baseLocale = 'en';
    const baseKeys = keysByLocale[baseLocale];
    const baseKeySet = new Set(baseKeys);

    // Scan source
    const allSourceFiles = [];
    sourceDirectories.forEach((dir) => {
        const dirPath = path.join(projectRoot, dir);
        if (fs.existsSync(dirPath)) allSourceFiles.push(...getSourceFiles(dirPath));
    });

    const usedKeys = new Set();
    const dynamicPatterns = new Set();

    allSourceFiles.forEach((file) => {
        const code = fs.readFileSync(file, 'utf8');
        const { usedKeys: fUsed, dynamicKeyPatterns: fDyn } = extractUsedKeysFromCode(code);
        fUsed.forEach((k) => usedKeys.add(k));
        fDyn.forEach((p) => dynamicPatterns.add(p));
    });

    console.log(`\n✅ Found ${usedKeys.size} static keys used in code.`);

    // Check for missing keys across locales
    console.log('\n' + '='.repeat(50));
    console.log('🌍 LOCALE SYNC CHECK');
    console.log('='.repeat(50));

    const pluralSuffixes = ['zero', 'one', 'two', 'few', 'many', 'other'];
    const requiredPlurals = {
        en: ['one', 'other'],
        pl: ['one', 'few', 'many', 'other']
    };

    const getPluralGroups = (keys) => {
        const groups = new Set();
        keys.forEach(k => {
            if (k.endsWith('.other') && keys.includes(k.replace(/\.other$/, '.one'))) {
                groups.add(k.replace(/\.other$/, ''));
            }
        });
        return groups;
    };

    const basePluralGroups = getPluralGroups(baseKeys);

    translationFiles.forEach((file) => {
        if (file.locale === baseLocale) return;

        const currentKeys = keysByLocale[file.locale];
        const currentKeySet = new Set(currentKeys);
        
        const missing = [];
        const extra = [];
        const localeReqPlurals = requiredPlurals[file.locale] || ['one', 'other'];

        // Check for missing keys based on base keys
        baseKeys.forEach(k => {
            const lastDot = k.lastIndexOf('.');
            const group = lastDot !== -1 ? k.substring(0, lastDot) : '';
            const suffix = lastDot !== -1 ? k.substring(lastDot + 1) : '';
            const isPluralBase = basePluralGroups.has(group) && pluralSuffixes.includes(suffix);
            
            if (isPluralBase) {
                return; // Handled in group check
            }
            
            if (!currentKeySet.has(k)) {
                missing.push(k);
            }
        });

        // Check plural groups
        basePluralGroups.forEach(group => {
            localeReqPlurals.forEach(suffix => {
                const reqKey = `${group}.${suffix}`;
                if (!currentKeySet.has(reqKey)) {
                    missing.push(`${reqKey} (required plural)`);
                }
            });
        });

        // Check for extra keys
        currentKeys.forEach(k => {
            const lastDot = k.lastIndexOf('.');
            const group = lastDot !== -1 ? k.substring(0, lastDot) : '';
            const suffix = lastDot !== -1 ? k.substring(lastDot + 1) : '';
            
            if (basePluralGroups.has(group) && pluralSuffixes.includes(suffix)) {
                return; // Valid plural extension
            }
            
            if (!baseKeySet.has(k)) {
                extra.push(k);
            }
        });

        console.log(`\n[${file.locale.toUpperCase()}]`);
        if (missing.length > 0) {
            console.log(`❌ Missing (${missing.length}):`);
            missing.slice(0, 15).forEach((k) => console.log(`   - ${k}`));
            if (missing.length > 15) console.log(`   ... and ${missing.length - 15} more`);
            process.exitCode = 1;
        } else {
            console.log('✅ All base keys and required plural forms present.');
        }

        if (extra.length > 0) {
            console.log(`⚠️  Extra (${extra.length}):`);
            extra.slice(0, 5).forEach((k) => console.log(`   - ${k}`));
        }
    });

    // Unused keys check
    console.log('\n' + '='.repeat(50));
    console.log('🗑️  UNUSED KEYS CHECK (Experimental)');
    console.log('='.repeat(50));

    const unused = baseKeys.filter((k) => {
        if (usedKeys.has(k)) return false;

        // Check if it might be used dynamically (very basic check)
        const parts = k.split('.');
        const prefix = parts[0];
        const suffix = parts[parts.length - 1];

        for (const pattern of dynamicPatterns) {
            if (pattern.includes(prefix) || pattern.includes(suffix)) return false;
        }

        return true;
    });

    if (unused.length > 0) {
        console.log(`⚠️  Found ${unused.length} potentially unused keys in ${baseLocale}.json:`);
        unused.slice(0, 20).forEach((k) => console.log(`   - ${k}`));
        if (unused.length > 20) console.log(`   ... and ${unused.length - 20} more`);
    } else {
        console.log('✅ No obviously unused keys found.');
    }

    // Code Usage Check
    console.log('\n' + '='.repeat(50));
    console.log('🔍 CODE USAGE CHECK');
    console.log('='.repeat(50));

    const missingBaseKeys = Array.from(usedKeys).filter((k) => !baseKeySet.has(k));
    
    // Filter out keys that are objects or plurals in the JSON (e.g., used 'key' in code, but JSON has 'key.one' and 'key.other')
    const definitelyMissing = missingBaseKeys.filter(k => {
        const isPluralOrObject = baseKeys.some(baseKey => baseKey.startsWith(k + '.'));
        return !isPluralOrObject;
    });

    if (definitelyMissing.length > 0) {
        console.log(`❌ Found ${definitelyMissing.length} keys used in code but missing from ${baseLocale}.json:`);
        definitelyMissing.slice(0, 20).forEach((k) => console.log(`   - ${k}`));
        if (definitelyMissing.length > 20) console.log(`   ... and ${definitelyMissing.length - 20} more`);
        process.exitCode = 1;
    } else {
        console.log(`✅ All static keys used in code exist in ${baseLocale}.json.`);
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ Analysis complete.');
}

analyze();
