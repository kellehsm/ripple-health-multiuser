# Ripple Health

> Every choice sends ripples. Ripple Health shows you where they go.

Most wellness apps track one thing in isolation — your steps, your calories, your budget. But life doesn't work in silos. A stressful week at work bleeds into late-night takeout orders, which hits your bank account, which adds more stress. Ripple Health is built on the premise that these patterns are connected, and that seeing them together is what actually changes behavior.

The app pulls together five dimensions of daily life into a single view so the links between them become visible over time.

---

## What it tracks

**Health** — Steps, sleep, and heart rate synced from Android Health Connect. Continuous glucose data pulled from Dexcom. The baseline picture of how your body is actually doing day to day.

**Meals** — Barcode scanning and food search for logging what you eat. Meal entries are cross-referenced against glucose readings to surface how specific foods affect your blood sugar in the hours after eating.

**Life** — Mood logging, hobby time, and book progress. The stuff that signals whether life feels good or just busy — and whether the answer correlates with what you ate or how you slept.

**Finance** — Spending logs with category breakdowns. Impulsive spending and stress eating often show up on the same days. Seeing both in one place makes that pattern hard to ignore.

**Home** — A daily overview that aggregates signals from all four tabs: glucose trend, step count, mood, water intake, and spending — so you start each day with the full picture rather than fragments.

---

## The idea

The dots have always been there. Most people already know, somewhere in the back of their mind, that they eat worse when they're tired, spend more when they're stressed, and move less when they're stuck inside. Ripple Health just makes those connections explicit and consistent enough to act on.

---

## Stack

- **React Native** (Expo SDK 57) with TypeScript
- **Android Health Connect** via `expo-health-connect` for biometric data
- **Dexcom API** integration for real-time CGM glucose data
- **Node.js / Express** backend (`/wellness-app`) with PostgreSQL
- **EAS Build** for Android APK distribution
- **Caddy** reverse proxy with automatic TLS on `app.kels.gg`

---

## Project structure

```
src/
  screens/       # HealthScreen, MealsScreen, LifeScreen, FinanceScreen, OverviewScreen
  components/    # MetricCard, BarcodeScannerModal
  api/           # Typed API client pointing at app.kels.gg/api
  lib/           # Health Connect sync logic
  theme/         # Shared colors, spacing, typography
```

---

## Building

Requires an EAS account. Builds are triggered via:

```bash
npx eas-cli@latest build --platform android --profile preview --non-interactive
```
