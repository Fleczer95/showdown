const assert = require('node:assert/strict');
const test = require('node:test');

const { _private } = require('./withIosMMKVBackupPolicy.cjs');

const STORE_IDS = ['showdown-progression', 'showdown-settings', 'showdown-profile'];
const APP_DELEGATE = `import Expo
import FirebaseCore
import React
import ReactAppDependencyProvider

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  public override func application() -> Bool {
    let factory = ExpoReactNativeFactory(delegate: ReactNativeDelegate())
    bindReactNativeFactory(factory)
    RNFBAppCheckModule.sharedInstance()
    FirebaseApp.configure()
    return true
  }
}`;

test('injects an allowlist policy without disturbing Firebase initialization', () => {
    const result = _private.injectIosMMKVBackupPolicy(APP_DELEGATE, STORE_IDS);

    for (const storeId of STORE_IDS) {
        assert.match(result, new RegExp(`"${storeId}"`));
    }

    assert.match(result, /contentsOfDirectory/);
    assert.match(result, /fileName\.hasSuffix\("\.crc"\)/);
    assert.match(result, /values\.isExcludedFromBackup = !Self\.backedUpNamespaces\.contains\(namespace\)/);
    assert.match(result, /UIApplication\.didEnterBackgroundNotification/);
    assert.match(result, /ShowDownMMKVBackupPolicy\.shared\.start\(\)/);
    assert.match(result, /RNFBAppCheckModule\.sharedInstance\(\)/);
    assert.match(result, /FirebaseApp\.configure\(\)/);
    assert.equal((result.match(/FirebaseApp\.configure\(\)/g) ?? []).length, 1);
});

test('injection is idempotent', () => {
    const once = _private.injectIosMMKVBackupPolicy(APP_DELEGATE, STORE_IDS);
    const twice = _private.injectIosMMKVBackupPolicy(once, STORE_IDS);

    assert.equal(twice, once);
    assert.equal((twice.match(/private final class ShowDownMMKVBackupPolicy/g) ?? []).length, 1);
    assert.equal((twice.match(/ShowDownMMKVBackupPolicy\.shared\.start\(\)/g) ?? []).length, 1);
});

test('the default allowlist contains only durable user state', () => {
    assert.deepEqual(_private.DEFAULT_MMKV_STORE_IDS, STORE_IDS);

    const policy = _private.renderSwiftPolicy();
    assert.doesNotMatch(
        policy,
        /showdown-device|showdown-store|showdown-offline-runs|showdown-history|showdown-leaderboard|showdown-ranking|showdown-challenges|showdown-analytics/,
    );
});

test('Info.plist compliance removes unused purpose strings and locks down ATS', () => {
    const infoPlist = {
        CFBundleName: 'ShowDown',
        NSMicrophoneUsageDescription: 'Added by expo-audio',
        NSMotionUsageDescription: 'Added by expo-sensors',
        NSAppTransportSecurity: {
            NSAllowsArbitraryLoads: true,
            NSAllowsLocalNetworking: true,
        },
    };

    const result = _private.applyInfoPlistCompliance(infoPlist);

    for (const key of _private.REMOVED_PURPOSE_STRINGS) {
        assert.equal(Object.hasOwn(result, key), false);
    }
    assert.equal(result.NSAppTransportSecurity.NSAllowsArbitraryLoads, false);
    assert.equal(result.NSAppTransportSecurity.NSAllowsLocalNetworking, true);
    assert.equal(result.CFBundleName, 'ShowDown');
});

test('invalid store IDs cannot inject Swift or escape the MMKV namespace', () => {
    assert.throws(() => _private.validatedStoreIds(['showdown-good', 'bad"\nSwift.inject()']), /invalid MMKV store id/);
    assert.throws(() => _private.validatedStoreIds([]), /non-empty array/);
});
