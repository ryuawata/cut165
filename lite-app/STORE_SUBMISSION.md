# App Store listing and release checklist

## Proposed metadata (review before publishing)

- App name: CUT365 Lite
- Subtitle: Simple calorie & protein log
- Category: Health & Fitness
- Suggested paid price: US $4.99 initially (set in App Store Connect; not in code)
- Keywords: calories,protein,food log,macro tracker,nutrition,meal log
- Promotional text: Log your numbers. Get on with your day.
- Description:

CUT365 Lite is a simple, private food ledger for people who want to track calories and protein without searching a food database.

Quickly log the numbers you know, save frequently eaten foods, and repeat them with one tap. Review previous days and choose daily targets that work for you.

What you get:
- Quick manual calorie and protein entries
- Saved foods for repeat logging
- Daily totals and adjustable goals
- Easy edits and past-day history
- Offline, on-device storage

No account required. No ads, subscriptions, or food-scanning complexity.

Nutrition amounts are estimates entered by you. CUT365 Lite is not medical advice. Deleting the app can remove locally saved data.

## App privacy answer to verify

App code does not send nutrition entries to a developer-controlled server, include analytics, or integrate advertising SDKs. If this remains true in the shipped binary, the developer can select **Data Not Collected** in App Store Connect. Confirm by reviewing all dependencies and runtime behavior; do not assume Apple automatically determines the privacy label.

## Public URLs that must go live

Apple requires valid public URLs for support and app privacy. Publish `PRIVACY.md` as a public website page and provide an email/contact method. A GitHub repository file is not a substitute for a clear customer support page.

## Screenshots

Capture *real, running iPhone app* screenshots of Today, Add food, Saved foods, History, and Goals on an Apple-supported screenshot size. Don't fabricate device screenshots or imply features not shipped.

## Final test checklist

- [ ] Cold install: onboarding/default state opens and no fake entries appear
- [ ] Create entry with 0 calories / 0 protein; other fields validated
- [ ] Reject negative, NaN, and unbounded numeric values
- [ ] Edit entry, delete entry (confirm), and verify totals
- [ ] Favorite a food and use one-tap repeat on a different day
- [ ] Navigate backward/forward dates, including month/year boundaries
- [ ] Change goals and confirm they're saved
- [ ] Force quit and relaunch: entries and goals persist
- [ ] Offline mode: all flows work
- [ ] Small iPhone screen, large text, VoiceOver, keyboard dismissal
- [ ] Final icon, display name, identifier, price, policy/support URLs
- [ ] TestFlight internal test and production build from same commit
- [ ] Paid Apps Agreement, bank/tax setup, app review information
- [ ] Submit to Apple and respond to review requests

The project is *configured* for Expo/EAS but no iOS build is verifiable until Expo authentication, Apple signing, and live device tests are completed.
