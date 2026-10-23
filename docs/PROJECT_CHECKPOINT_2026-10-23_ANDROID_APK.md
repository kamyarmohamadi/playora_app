# Playora checkpoint — Android packaging — 2026-10-23

## Source of truth
- Repository: https://github.com/kamyarmohamadi/playora_app
- Active branch: `feature/playora-platform-game-plugin-architecture-2026-10-22`
- Main branch has not been modified by this work.

## Changes committed
- `capacitor.config.json`: Capacitor app metadata for Android packaging (app ID `com.playora.app`, app name Playora, web assets from `dist`).
- `.github/workflows/android-apk.yml`: repeatable GitHub Actions workflow to build a debug APK from the current app, with public Supabase URL/publishable key injected for the development project.
- `docs/ANDROID_APK_BUILD_FA.md`: Persian APK build/install instructions and explicit OAuth caveats.
- `README.md`: links to Android build instructions.

## Build status — not successful yet
- Android workflow run: https://github.com/kamyarmohamadi/playora_app/actions/runs/40009690956
- Quality-gate workflow run: https://github.com/kamyarmohamadi/playora_app/actions/runs/40009691038
- Android job was marked failed before any step began: `steps=[]`, `runner_id=0`. This is consistent with the previously observed GitHub Actions runner allocation problem. It does not establish whether the Gradle build or app code succeeds.
- No APK artifact was produced or verified, so do not present an APK download link until a successful run has uploaded one.

## Authentication
- The web client already contains Supabase email/password, signup, password recovery and Google OAuth calls.
- Android build workflow uses the active development project's browser-safe URL and publishable key by default; these are not server secrets.
- Google OAuth is not yet proven live. The Google OAuth client secret must be configured in Supabase's Auth provider settings; it must not be committed to GitHub or shipped in the APK. Android deep-link return from Google OAuth and on-device sign-in remain separate acceptance tests.
- Auth guide: https://github.com/kamyarmohamadi/playora_app/blob/feature/playora-platform-game-plugin-architecture-2026-10-22/docs/GOOGLE_AUTH_SETUP_FA.md

## Known product limitations
- This APK workflow packages the current platform UI. The 8 game catalogue entries are metadata cards; no game plugin is currently enabled, so the app must not be represented as having fully playable games.
- This workflow creates a debug APK for device testing, not a signed production release.
- Payments, cash prizes and wagering remain disabled.

## Next required actions
1. Restore GitHub Actions runner availability/permissions, then rerun the Android workflow.
2. Fix any dependency/build errors surfaced once a runner actually starts.
3. Configure and test Google OAuth, including Android deep-link return.
4. Install the resulting APK on a real Android device and record the result before calling it a usable test release.
5. For each future code change, build and attach a new APK only after successful artifact generation.


## Follow-up — repository visibility and retry (2026-10-23)
- The owner changed repository visibility to `public`; verified through GitHub repository metadata.
- Retried the Android APK workflow (`40009780847`) and quality-gate workflow (`40009789129`) after the visibility change.
- Both retries again failed in the initial `Set up job` step. GitHub reports no runner logs (`logs_url=null`) and no subsequent build steps. Android run has no artifacts.
- This is still an Actions runner/job startup failure, not a verified application compilation failure. APK remains unbuilt/unverified.
- Next: get a new workflow run to start on a runner; only then address any dependency, TypeScript, Vite or Gradle errors shown by actual logs.
