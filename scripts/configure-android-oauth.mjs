import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function configureAndroidOAuthManifest(xml) {
  let activityStart = -1;
  let activityTagEnd = -1;
  let activityTag = "";
  let searchFrom = 0;

  while (searchFrom < xml.length) {
    const start = xml.indexOf("<activity", searchFrom);
    if (start < 0) break;
    const end = xml.indexOf(">", start);
    if (end < 0) break;
    const tag = xml.slice(start, end + 1);
    if (tag.includes('android:name=".MainActivity"')) {
      activityStart = start;
      activityTagEnd = end;
      activityTag = tag;
      break;
    }
    searchFrom = end + 1;
  }

  if (activityStart < 0) {
    throw new Error("Could not find the Capacitor .MainActivity declaration in AndroidManifest.xml");
  }

  const launchPrefix = 'android:launchMode="';
  const launchStart = activityTag.indexOf(launchPrefix);
  if (launchStart < 0) {
    activityTag = activityTag.slice(0, -1) + ' android:launchMode="singleTask">';
  } else {
    const valueStart = launchStart + launchPrefix.length;
    const valueEnd = activityTag.indexOf('"', valueStart);
    if (activityTag.slice(valueStart, valueEnd) !== "singleTask") {
      activityTag = activityTag.slice(0, valueStart) + "singleTask" + activityTag.slice(valueEnd);
    }
  }

  let updated = xml.slice(0, activityStart) + activityTag + xml.slice(activityTagEnd + 1);
  const bodyStart = activityStart + activityTag.length;
  const activityEnd = updated.indexOf("</activity>", bodyStart);
  if (activityEnd < 0) throw new Error("The Capacitor MainActivity has no closing activity tag");

  const body = updated.slice(bodyStart, activityEnd);
  const alreadySet =
    body.includes('android:scheme="com.playora.app"') &&
    body.includes('android:host="auth"') &&
    body.includes('android:path="/callback"');
  if (alreadySet) return updated;

  const filter = [
    "",
    '            <intent-filter android:autoVerify="false">',
    '                <action android:name="android.intent.action.VIEW" />',
    '                <category android:name="android.intent.category.DEFAULT" />',
    '                <category android:name="android.intent.category.BROWSABLE" />',
    '                <data android:scheme="com.playora.app" android:host="auth" android:path="/callback" />',
    "            </intent-filter>",
    ""
  ].join("\n");

  return updated.slice(0, activityEnd) + filter + updated.slice(activityEnd);
}

const target = process.argv[2] ?? "android/app/src/main/AndroidManifest.xml";
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const original = readFileSync(target, "utf8");
  const configured = configureAndroidOAuthManifest(original);
  if (configured !== original) writeFileSync(target, configured, "utf8");
  process.stdout.write("Playora Android OAuth deep link is configured.\n");
}
