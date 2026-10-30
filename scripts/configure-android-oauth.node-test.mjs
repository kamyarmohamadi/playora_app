import test from "node:test";
import assert from "node:assert/strict";
import { configureAndroidOAuthManifest } from "./configure-android-oauth.mjs";

const template = `<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <application>
    <activity android:name=".MainActivity" android:exported="true">
      <intent-filter><action android:name="android.intent.action.MAIN" /></intent-filter>
    </activity>
  </application>
</manifest>`;

test("adds the Playora callback and singleTask launch mode", () => {
  const result = configureAndroidOAuthManifest(template);
  assert.ok(result.includes('android:launchMode="singleTask"'));
  assert.ok(result.includes('android:scheme="com.playora.app"'));
  assert.ok(result.includes('android:host="auth"'));
  assert.ok(result.includes('android:path="/callback"'));
  assert.ok(result.includes("android.intent.category.BROWSABLE"));
});
test("is idempotent", () => {
  const once = configureAndroidOAuthManifest(template);
  assert.equal(configureAndroidOAuthManifest(once), once);
});
test("fails rather than silently producing an unusable APK", () => {
  assert.throws(() => configureAndroidOAuthManifest("<manifest />"), /MainActivity/);
});
