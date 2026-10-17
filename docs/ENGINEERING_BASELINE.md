# Engineering Baseline

Reviewed against the repository tree on 2026-10-17.

## Observed repository state

- The default branch is main.
- The root contains a short README, a small project ZIP, a nested bazi folder with an audit note and another ZIP.
- The default-branch tree does not currently expose a package.json, lockfile, tsconfig, complete application source tree, or CI workflow at the root.
- A separate fix/playora-v1 branch has a validator source file, but that alone is not a complete application source tree.
- Previously inspected contents of the archived bazi package had test failures and a TypeScript build failure. Any fixes made in an isolated prototype must not be assumed to be integrated into GitHub.

## What this means

- A complete clean install, application build, end-to-end browser verification, and production security audit cannot be claimed from the default-branch repository as currently structured.
- Documentation and project instructions can be validated as text, but they do not prove the game is working.
- Before feature development, extract/review the intended source package, establish a canonical app directory, bring all source and lockfile into version control, and make the base build and tests reproducible.
- Do not add a CI workflow that pretends to build a runnable application while the relevant source and scripts are absent. Add CI after the source of truth and reproducible project scripts have been established.

## Next implementation sequence

1. Establish one canonical, directly buildable application source tree and a pinned dependency lockfile.
2. Restore repeatable typecheck, unit-test, lint, and production-build commands and fix existing failures.
3. Add unit tests for manifests, registry behavior, core game rules, and game API compatibility.
4. Implement and verify backgammon legality before calling the game complete.
5. Design and test the game isolation boundary, CSP/headers, capability allowlist, and message validation before loading untrusted game code.
6. Add Playwright smoke paths and RTL responsive screenshots; make these part of the repeatable release gate.
7. Add CI to enforce the real checks above.

## Important distinction

This file records the observed baseline, not a claim that the planned architecture or future controls have already been implemented.
