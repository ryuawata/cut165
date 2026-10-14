# Release status (2026-10-14)

## Verified
- The `lite` branch remains isolated from `main`.
- Vercel successfully deployed the Lite web app and the stable branch alias serves the Lite homepage.
- Public web routes now exist for `/privacy` and `/support`.
- Standalone Expo SDK 54 React Native app exists in `lite-app/`.
- GitHub Actions run `38617622259` passed dependency installation, TypeScript checking, and `npx expo install --check` after the native validation fix.
- Native numeric input and persisted-date validation regexes were corrected in commit `b03b6cab9960c5c9ab30bd51a2d553e691282fa9`.
- Manual calorie and protein entry, editing, deletion, totals, saved foods, one-tap repeat, date history, and editable goals are implemented.
- Offline SQLite-backed key/value persistence uses serialized writes.
- iOS EAS build/submit configuration, draft store metadata, and privacy policy are present.

## Still blocking App Store submission
- No iOS production binary has been built and installed on a real iPhone yet.
- Expo account/EAS project initialization is not verified.
- Apple Developer Program membership, signing/provisioning, App Store Connect app record, and bundle identifier ownership are not verified.
- The generated 1024x1024 icon still needs visual verification in a real iOS build.
- TestFlight persistence, accessibility, keyboard behavior, and small-screen testing have not been performed on device.
- Store screenshots have not been captured from the running native app.
- Paid Apps Agreement, tax, and banking setup must be complete before selling a paid app.
- App Review contact information and final support channel must be entered in App Store Connect.
- The current support page sends users to a public GitHub issue form. Replace it with a private support method before launch if public support requests are undesirable.

## Public listing URLs
- Privacy: `https://cut165-git-lite-ryuawatas-projects.vercel.app/privacy`
- Support: `https://cut165-git-lite-ryuawatas-projects.vercel.app/support`

Confirm both are publicly reachable without authentication immediately before App Store submission.

## Next actionable commands

```bash
git checkout lite
cd lite-app
npm install
npm run check
npx expo install --check
npx expo start

# After device QA and account setup:
npx eas-cli login
npx eas-cli init
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --profile production
```

Do not commit Apple credentials, authentication tokens, certificates, or provisioning profiles. The app is code/CI-ready for the next phase, but it is not App Store-ready until a signed iOS build has passed TestFlight/device QA.
