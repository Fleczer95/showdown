const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..');
const nativeGradle = readFileSync(path.join(projectRoot, 'android/app/build.gradle'), 'utf8');
const patchScript = readFileSync(path.join(__dirname, 'patch-build-gradle.js'), 'utf8');

for (const quote of ['"', "'"]) {
    test(`prebuild repairs a regenerated legacy default (${quote}) without changing other native settings`, () => {
        const root = mkdtempSync(path.join(os.tmpdir(), 'showdown-r8-'));
        try {
            mkdirSync(path.join(root, 'scripts'));
            mkdirSync(path.join(root, 'android/app'), { recursive: true });
            writeFileSync(path.join(root, 'package.json'), '{"type":"module"}');
            const scriptPath = path.join(root, 'scripts/patch-build-gradle.js');
            const gradlePath = path.join(root, 'android/app/build.gradle');
            writeFileSync(scriptPath, patchScript);
            const regenerated = nativeGradle.replace(
                /getDefaultProguardFile\(["']proguard-android(?:-optimize)?\.txt["']\)/g,
                `getDefaultProguardFile(${quote}proguard-android.txt${quote})`,
            );
            writeFileSync(gradlePath, regenerated);
            execFileSync(process.execPath, [scriptPath]);
            const expected = regenerated.replaceAll('proguard-android.txt', 'proguard-android-optimize.txt');
            assert.equal(readFileSync(gradlePath, 'utf8'), expected);
            execFileSync(process.execPath, [scriptPath]);
            assert.equal(readFileSync(gradlePath, 'utf8'), expected, 'a second prebuild must be idempotent');
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
}

test('committed native and Expo release configuration enable R8 optimization', () => {
    assert.match(nativeGradle, /getDefaultProguardFile\(["']proguard-android-optimize\.txt["']\)/);
    const properties = readFileSync(path.join(projectRoot, 'android/gradle.properties'), 'utf8');
    assert.match(properties, /^android\.enableMinifyInReleaseBuilds=true\s*$/m);
    const app = JSON.parse(readFileSync(path.join(projectRoot, 'app.json'), 'utf8'));
    const plugin = app.expo.plugins.find((entry) => Array.isArray(entry) && entry[0] === 'expo-build-properties');
    assert.equal(plugin?.[1]?.android?.enableMinifyInReleaseBuilds, true);
    assert.match(plugin?.[1]?.android?.extraProguardRules ?? '', /-keep @interface expo\.modules\.kotlin\.records\.Field \{ \*; \}/);
});

// Expo resolves this annotation through Kotlin reflection during audio startup.
test('release rules retain the Expo record field annotation used by reflection', () => {
    const rules = readFileSync(path.join(projectRoot, 'android/app/proguard-rules.pro'), 'utf8');
    assert.match(rules, /-keep\s+@interface\s+expo\.modules\.kotlin\.records\.Field\s*\{\s*\*;\s*\}/);
});
