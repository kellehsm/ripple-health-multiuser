# Ripple Health

> Every choice sends ripples. Ripple Health shows you where they go.

Ripple Health is a personal wellness app built around a single question: **how does everything I do affect my blood sugar, my sleep, and how I feel?**

Most trackers answer one thing in isolation. A CGM shows glucose. A step counter shows steps. A mood app shows mood. But the patterns that actually matter live in the *gaps between* those silos — the late dinner that sent glucose spiking overnight, the stressful week that killed motivation to move, the hobby session that left mood elevated for two days after. Ripple Health is my attempt to put all of that in one place so those connections stop being invisible.

---

## The Question Behind It

I have continuous glucose data — a real-time window into how my body responds to the world. But blood sugar doesn't exist in a vacuum. It's shaped by:

- **What I eat** — not just carbs in isolation, but *which* foods, *when*, combined with what else was happening that day
- **How I move** — steps, activity, whether I walked after eating
- **How I sleep** — quality and duration the night before, which shapes insulin sensitivity the next day
- **How I feel** — stress and mood have direct physiological effects on glucose that don't show up in any meal log
- **What I'm doing** — hobbies, creative work, social time, reading; the texture of a day matters
- **Financial stress** — spending patterns track closely with stress eating and low-energy days in ways I wanted to make visible

The goal is understanding and  seeing the actual shape of cause and effect in my own life.
---

## Screenshots

### Home — Daily Overview
*Glance summary, streak badge, mood picker with emoji tiles, weekly recap card*

<!-- screenshot: home screen overview -->

---

### Health — Biometrics Dashboard
*Live glucose chart with trend arrow, steps, sleep, water, heart rate metric cards*

<!-- screenshot: health screen with glucose chart -->

### Health — Steps Weekly Breakdown
*Tap the steps card to open a bar chart breakdown with daily average, best day, and % vs. last week*

<!-- screenshot: steps detail sheet modal -->

---

### Meals — Food & Glucose Response
*Barcode scan or food search to log meals; post-meal glucose overlay 60–90 min after eating*

<!-- screenshot: meals screen with food log -->

---

### Life — Hobbies & Reading
*Log hobby time with ratings and notes; book progress tracking; weekly stats*

<!-- screenshot: life screen with hobbies and books -->

---

### Finance — Spending Patterns
*Weekly budget progress, category breakdown, stress-spend correlation chart*

<!-- screenshot: finance screen -->

---

### History — Cross-Domain Search
*Search glucose by threshold, meals by name or carbs, mood by score range, spending by category*

<!-- screenshot: history search screen -->

---

### Settings — Preferences & Export
*Week start day picker, mood reminders, Health Connect toggles, PDF doctor report, full JSON backup*

<!-- screenshot: settings screen -->

---

### Android Home Screen Widget
*Glucose reading + steps at a glance, tappable to refresh, updates every 30 minutes*

<!-- screenshot: android home screen with widget -->

---

## What It Tracks

### Blood Sugar
Real-time CGM readings via **Dexcom** integration. Glucose chart with 3h / 6h / 12h / 24h windows, trend arrow, high/low alerts, yesterday overlay for direct comparison, post-meal response analysis, and time-in-range calculation. The foundation that everything else is measured against.

### Steps & Activity
30 days of history synced from **Android Health Connect**. Weekly totals respect your chosen week-start day. Tapping the steps card opens a bar chart breakdown by day with daily average, best day, and % comparison to last week.

### Sleep
Session duration synced from Health Connect. Yesterday's sleep and 7-day average visible at a glance. Sleep quality the night before is one of the strongest predictors of next-day glucose patterns.

### Heart Rate
Historical BPM chart from Health Connect, viewable across any time window. Resting vs. peak comparison.

### Water
Quick-log glasses of water with daily goal tracking and 7-day running average.

### Meals
Food search (USDA database) and barcode scanning. Logs carbs, protein, fat, and calories. Each meal is cross-referenced with CGM data to show what your glucose actually did 60–90 minutes after eating — not what it *should* do based on carb count, but what it *did*.

### Mood
Five-point scale (😣 → 😕 → 😐 → 🙂 → 😃) with optional free-text journaling. Four check-in periods per day (morning, afternoon, evening, night) with configurable push reminders. Weekly mood summary and searchable history.

### Hobbies
Track anything — guitar, climbing, cooking, gaming, walking, whatever makes a day feel like more than work. Log time in minutes with a 1–5 rating and optional note. Stats show weekly totals and trends. The hypothesis: hobby time and mood correlate more strongly than most people expect.

### Books
Reading list with per-session page logging. Tracks pace and progress toward finishing. Included because reading hours and stress levels tend to move in opposite directions — another signal worth having.

### Spending
Log expenses with categories. Weekly budget progress bar. The category breakdown makes it possible to see when stress is showing up in spending before you've consciously registered that the week was hard.

---

## Analysis Features

**Post-meal glucose response** — For any logged meal, see your actual glucose curve from 60–90 minutes after eating. Identify which foods spike you vs. which you tolerate well, in the context of your actual life (not a controlled study).

**Stress-spend correlation** — Spending and mood overlaid on the same timeline. Makes the link between emotional state and financial impulse visible and measurable over time.

**Cross-domain history search** — Filter across any data type:
- Glucose readings above a custom threshold, grouped by time of day
- Meals by name keyword or minimum carb content
- Mood entries by score range and date window
- Spending by category and minimum amount

**Streak tracking** — Consecutive days of meal logging shown on the home screen with a 🔥 badge at 3+ days. No guilt framing — just a lightweight signal for consistency.

**Weekly recap** — Dismissible Monday card summarizing last week: steps total, hobby sessions, meals logged, mood pattern.

**Doctor report** — Generate a PDF with glucose stats (avg, time-in-range, high/low events), trend chart, and a meal-glucose correlation table. Designed to be something you'd actually bring to an appointment.

**Full data export** — One-tap JSON backup of everything: glucose, meals, mood, spending, books, hobbies, sleep, heart rate, metrics. Your data stays yours.

---

## Stack

| Layer | Tech |
|---|---|
| Mobile | React Native + Expo SDK 57, TypeScript |
| Navigation | React Navigation (stack + bottom tabs) |
| Biometrics | Android Health Connect (`expo-health-connect`) |
| CGM | Dexcom Share API (polled by backend every 5 min) |
| Backend | Node.js + Fastify + PostgreSQL |
| Builds | EAS Build (Android, internal APK distribution) |
| Infra | VPS + Caddy reverse proxy (auto TLS at `app.kels.gg`) |
| Notifications | notifee foreground service + expo-notifications |

---

## Project Structure

```
src/
  screens/        OverviewScreen, HealthScreen, MealsScreen, LifeScreen,
                  FinanceScreen, HistoryScreen, SettingsScreen
  components/     MetricCard, BarcodeScannerModal
  api/            client.ts — all typed API calls
  lib/            healthConnect.ts (30-day sync), foregroundService.ts
  theme/          ThemeContext, light/dark color tokens
  navigation/     RootTabs.tsx

plugins/
  withForegroundServiceType.js    patches notifee foreground service manifest entry
  withAndroidWidget.js            adds home screen widget via config plugin
  android-widget/
    RippleWidgetProvider.kt       fetches glucose + steps, renders via RemoteViews
    ripple_widget.xml             widget layout
    ripple_widget_info.xml        widget metadata (2×2 cells, 30-min refresh)
```

---

## Backend

The API server lives in a companion repo: **[kellehsm/wellness-app](https://github.com/kellehsm/wellness-app)**

It handles Dexcom polling, Health Connect data ingestion, USDA food search, cross-domain pattern analysis, PDF report generation, and the search endpoints that make the correlation features possible.

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
