# CUT365 Lite

A native iPhone calorie and protein ledger. This project is independent of the root Next.js/Supabase app, which remains unchanged on `main`.

## Features

- Log calories and protein with an optional food name
- Edit, delete, or repeat a saved food in one tap
- Navigate daily history
- Set daily calorie/protein goals
- Persist all data locally, offline, with Expo SQLite key-value storage
- No accounts, ads, trackers, cloud sync, food database, or subscriptions

## Development

Requires Node.js and npm.

```bash
cd lite-app
npm install
npx expo install --check
npm run check
npx expo start
```

Use Expo Go to test on a real device. Check both an initial fresh install and the persistence/edit/delete paths before release.

## Apple release

1. Enroll in the Apple Developer Program and accept the Paid Applications Agreement.
2. Decide the final public name, developer/seller name, bundle identifier, and paid price in App Store Connect. The current bundle ID is a placeholder, change it before creating the App ID.
3. Create the Expo/EAS project: `npx eas-cli login` then `npx eas-cli init` from `lite-app/`.
4. Run `npx eas-cli build --platform ios --profile production`. Allow EAS to create Apple signing credentials.
5. Create the app in App Store Connect with the same bundle ID. Set pricing and availability, tax/banking agreements, age rating, support URL, privacy URL, screenshots and review contact.
6. Upload with `npx eas-cli submit --platform ios --profile production`. Then select the processed build and submit for Apple review.
7. Test via TestFlight before submitting for review.

See `STORE_SUBMISSION.md` for launch copy, disclosures, and release QA.

**Never add Apple passwords, .p8 API keys, EAS tokens, or signing keys to git.**

## Privacy / limitations

All entries are local to a single iPhone installation. Deleting the app may delete the data. No backups, syncing, or migration from full CUT365. Totals are user-supplied estimates, not verified dietary advice. The app does not provide medical advice.
