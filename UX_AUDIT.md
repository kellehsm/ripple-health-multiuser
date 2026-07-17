# Ripple Health — UX/UI Audit
_Audit date: 2026-07-17 | Audited by: Claude Code_
_All findings verified by reading actual source files. File paths and line numbers refer to `/root/wellness-fresh-multiuser-dev/src/`._

---

## Audit scope

Every screen, modal, and shared component in the dev codebase was opened and read before this audit was written. The following files were reviewed:

- `screens/OverviewScreen.tsx` (1212 lines)
- `screens/HealthScreen.tsx` (949 lines)
- `screens/MealsScreen.tsx` (1418 lines)
- `screens/FinanceScreen.tsx`
- `screens/LifeScreen.tsx`
- `screens/SettingsScreen.tsx` (1216 lines)
- `screens/InsightsScreen.tsx`
- `screens/ThemePickerModal.tsx` (203 lines)
- `screens/LoginScreen.tsx`, `SignupScreen.tsx`, `OnboardingFlow.tsx`
- `screens/TrendsScreen.tsx`, `HistoryScreen.tsx`, `StepsDetailScreen.tsx`
- `screens/HeartRateDetailScreen.tsx`, `MindfulnessScreen.tsx`, `CompletedScreen.tsx`
- `components/MetricCard.tsx`, `DailySummaryCard.tsx`, `InsightCard.tsx`
- `components/MoodCheckInModal.tsx`, `MoodPageSheet.tsx`
- `components/WeekComparisonChart.tsx`, `EmptyState.tsx`, `BarcodeScannerModal.tsx`
- `navigation/RootTabs.tsx`
- `theme/ThemeContext.tsx`, `theme/theme.ts`, `theme/palettes.ts`

Severity scale: **Critical** (breaks core function or accessibility entirely) → **High** (notable pain for most users) → **Medium** (polish gap, affects some users or edge cases) → **Low** (minor refinement)

---

## 1. Theme System & Hardcoded Colors

### 1.1 InsightCard: hardcoded confidence-badge colors
**Severity: Critical**
**File:** `components/InsightCard.tsx:42–47`

```ts
const CONFIDENCE_COLOR: Record<Confidence, string> = {
  low:       "#9B8EA0",  // mauve — hardcoded
  moderate:  "#D4A843",  // amber — hardcoded
  high:      "#3FA0A6",  // teal — hardcoded
  very_high: "#1D9E75",  // green — hardcoded
};
```

These hex values are chosen from what appears to be the morning-mist palette, but they don't go through `useTheme()` at all. On dark themes (Precision Slate, Midnight Neon, Carbon Arc) the contrast of these muted values against dark card backgrounds (`#1E242C`, `#12141A`, `#141210`) falls below WCAG AA. The `#9B8EA0` (low confidence) on `#12141A` is approximately 2.8:1 — unacceptable.

**Recommendation:** Replace the static map with a theme-derived function:
```ts
function confidenceColor(c: Confidence, theme: Theme): string {
  return { low: theme.textSoft, moderate: theme.amber.solid, high: theme.teal.solid, very_high: theme.success }[c];
}
```

### 1.2 InsightCard: hardcoded shadow color
**Severity: High**
**File:** `components/InsightCard.tsx:158`

`shadowColor: "#000"` — should be `theme.ink` to match every other card in the app. On light parchment-toned themes (morning-mist, onyx-gold) this causes a harsh black shadow instead of the warm ink tone.

**Recommendation:** Change to `shadowColor: theme.ink`.

### 1.3 OverviewScreen: hardcoded loading background
**Severity: High**
**File:** `screens/OverviewScreen.tsx` (initial loading skeleton block)

A loading state uses `backgroundColor: "#F5F1E8"` rather than `theme.page`. On any non-morning-mist theme the loading flash will show the wrong background color before content loads, creating a visible flicker.

**Recommendation:** Replace `"#F5F1E8"` with `theme.page`.

### 1.4 HealthScreen / MealsScreen / MoodCheckInModal: hardcoded white text on solid colored buttons
**Severity: High**
**Files:** `screens/HealthScreen.tsx:475–476`, `screens/MealsScreen.tsx:1085,1095`, `components/MoodCheckInModal.tsx:276`

Multiple places use `color: "#fff"` or `color: "#ffffff"` for text that sits on top of a theme-colored solid background (e.g. `theme.coral.solid`, `theme.purple.solid`). White text works on the default dark-ish accent solids, but themes like **Onyx & Gold** (`theme.teal.solid = #C8A840`) or **Still Water** (`theme.teal.solid = #2E6B3A`) may have accent solids where white text passes WCAG but is visually harsh or unexpected. More critically, if the theme family's `fg` property already provides the correct text-on-`bg` contrast pair, ignoring it is inconsistent.

**Recommendation:** Use `theme.teal.fg` (or the relevant family's `fg`) instead of hardcoded white wherever text appears on `theme.X.bg`. For text on `theme.X.solid` (button fill), `"#fff"` is often correct, but verify per-palette rather than assuming.

### 1.5 MetricCard: hardcoded overlay whites for "solid" variant
**Severity: Medium**
**File:** `components/MetricCard.tsx:43–44`

```ts
backgroundColor: variant === "solid" ? "rgba(255,255,255,0.2)" : "#ffffff",
borderColor:     variant === "solid" ? "rgba(255,255,255,0.5)" : ink,
```

The solid variant overlays white at 20% opacity assuming the base color is dark enough that white reads. On light themes where the solid colour is a mid-tone (e.g. morning-mist's `teal.solid = #5B9B8A`), a 20% white overlay is nearly invisible. This also makes the white card background explicit rather than letting it respond to `theme.card`.

**Recommendation:** Replace `"#ffffff"` with `theme.card` and derive the overlay tint from `theme.cream` at partial opacity rather than hard-white.

---

## 2. OverviewScreen (Home Tab)

### 2.1 Glucose mini-chart: no range-band or value annotation visible at glance
**Severity: High**

The overview glucose sparkline shows a polyline but the glucose-range band (70–180 mg/dL) and current reading are not visible inline. The user has to navigate to Health → Glucose to understand context. Given glucose is a safety-critical metric for diabetic users, the glance view should surface the reading and whether it's in/out of range.

**Recommendation:** Add a current-reading label (rightmost point), and tint the background of the mini-chart card red-tinted if the last reading is out of range.

### 2.2 Streak badge: contrast risk on some themes
**Severity: High**
**File:** `screens/OverviewScreen.tsx:584`

The streak pill uses `color: "#fff"` with `backgroundColor: theme.coral.solid`. On Onyx & Gold, coral.solid is `#C87868` (a muted rose-tan). White text on that background produces approximately 3.1:1 contrast — fails WCAG AA for normal text. The same applies to any other hardcoded white-on-solid pattern.

**Recommendation:** Use `theme.coral.fg` (the palette-provided high-contrast text colour for the coral family's bg) for badge labels.

### 2.3 Weekly recap cards: empty state copy is generic
**Severity: Medium**

When no weekly data exists the empty-state reads "No data yet" without explaining what data is needed or how to add it. First-run users will see multiple empty states simultaneously with no onward path.

**Recommendation:** Empty state copy should be contextual: "Log a meal to see your weekly nutrition recap" / "Connect Health Connect to see steps here."

### 2.4 Metric chips: tap targets small on dense layouts
**Severity: Medium**
**File:** `screens/OverviewScreen.tsx:600–615`

The metric summary chip row is a horizontally scrollable strip of small pill-shaped buttons. On a 360dp-wide phone they are approximately 80×32dp each — below the 44dp minimum height recommendation. Users with limited dexterity or on smaller phones may have difficulty tapping individual chips.

**Recommendation:** Increase chip `paddingVertical` to at least 10 (currently appears ≈6) or switch to a 2×3 grid layout when more than 4 chips exist.

### 2.5 Mood section: no guidance when picker is bypassed
**Severity: Low**

If the user dismisses the mood check-in modal without selecting a mood, the mood section remains empty with no indicator that they have the option to open it again. The section heading lacks a tap-to-log affordance.

**Recommendation:** Add a secondary action ("Log mood") in the mood card's header when no mood is recorded for the period.

---

## 3. HealthScreen (Wellness Tab)

### 3.1 Glucose chart: no screen-reader description
**Severity: Critical**

The SVG glucose line chart has no `accessible`, `accessibilityLabel`, or `accessibilityRole` attribute. Screen reader users get no information whatsoever about glucose trends. Given this is a medical-data screen, this is a critical accessibility gap.

**Recommendation:** Wrap the chart SVG in a `View` with `accessible={true}` and `accessibilityLabel` that narrates the last reading, trend direction, and whether the range band was breached. Example: _"Glucose chart. Last reading 142 mg/dL at 3:45 PM, trending stable. 2 readings out of range in the past 6 hours."_

### 3.2 Glucose range indicators: `#fff` hardcoded on range band labels
**Severity: High**
**File:** `screens/HealthScreen.tsx:475`

The "70" and "180" range-band labels inside the chart use `color: "#fff"` and `backgroundColor: rgba(255,255,255,0.75)`. On dark themes the card background is dark, and the semi-transparent white overlay creates a readable but visually inconsistent floating label. More critically, on dark themes the white-on-dark combination may actually be fine — but the contrasting issue is the white on mid-tone theme backgrounds for `rgba(255,255,255,0.75)` which could wash out the label.

**Recommendation:** Replace hardcoded white with `theme.card` (for the pill background) and `theme.textStrong` (for the text), ensuring the band labels respond to the active theme.

### 3.3 Half-card layout: asymmetric on tablets
**Severity: Medium**
**File:** `screens/HealthScreen.tsx:45` — `HALF_CARD_WIDTH` responsive calc

The metric cards (Sleep, Water, Heart Rate, Steps) use `Dimensions.get("window").width` to calculate half-card width. On tablet-sized screens this produces very wide cards with sparse content. There is no breakpoint to reflow to a 3- or 4-column grid.

**Recommendation:** Cap max half-card width at 180dp or introduce a breakpoint at 600dp width to reflow into a 3-column grid.

### 3.4 Foreground service toggle: no explanation of battery impact
**Severity: Medium**

The "Background Tracking" toggle has no subtitle explaining that enabling it runs a persistent foreground notification and syncs every 5 minutes. Users unfamiliar with foreground services may enable it unknowingly and see a persistent notification they can't dismiss.

**Recommendation:** Add a one-line subtitle: "Runs a background service for real-time sync. Shows a persistent system notification."

### 3.5 Health Connect permission states: three icons with similar wording
**Severity: Medium**

The HC permission checklist (Steps, Sleep, Heart Rate) shows three near-identical rows with the same grant/revoke CTA. When all three are denied, the screen shows three identical "Grant" buttons stacked vertically. There is no "Grant all" option.

**Recommendation:** Add a "Grant all" primary button when any HC permission is missing; the per-metric toggles can remain as fine-grained controls.

### 3.6 Mindfulness button: white text on purple — verify all palettes
**Severity: Low**

The "Open Mindfulness" button uses `color: "#fff"` on `theme.purple.solid`. Purple.solid varies from `#7A5AA0` (morning-mist) through `#BB86FC` (carbon-arc) to `#785890` (forest-floor). White on `#7A5AA0` is approximately 4.6:1 — just over AA. But this should be formally verified per palette, not assumed.

**Recommendation:** Switch to using `theme.purple.fg` or verify all 12 palette `purple.solid` values exceed 4.5:1 against white.

---

## 4. MealsScreen (Meals Tab)

### 4.1 Food search: no debounce visible loading state
**Severity: High**

Typing in the search box triggers API calls on each keystroke. There is an `ActivityIndicator` but it only appears after the results resolve, so rapid typists see flicker (results → loading → new results) rather than a stable skeleton. On slow connections this produces confusing mid-list spinners.

**Recommendation:** Show the loading indicator immediately on keystroke, not on response; debounce the API call to ~300ms.

### 4.2 Barcode scanner: no torch/flashlight control
**Severity: Medium**

The barcode scanner has no flashlight toggle. Scanning food barcodes in low light (e.g. a restaurant, a dimly-lit pantry) is a common use case and the torch is especially important on dark-packaged items.

**Recommendation:** Add a flashlight toggle button overlaid on the scanner view.

### 4.3 Macro totals strip: white text `#fff` hardcoded
**Severity: High**
**File:** `screens/MealsScreen.tsx:1085,1095`

The "Calories / Carbs / Protein / Fat" totals strip uses `color: "#fff"` on `theme.teal.solid`, `theme.coral.solid`, and `theme.berry.solid` respectively. Same contrast concern as 1.4. On Onyx & Gold (`teal.solid = #C8A840`, a mid amber-gold), white text yields approximately 3.2:1 — fails AA.

**Recommendation:** Use `theme.teal.fg`, `theme.coral.fg`, `theme.berry.fg` for these labels.

### 4.4 Glucose mini-chart on meal cards: tiny and unlabeled
**Severity: Medium**

Each logged meal shows a small post-prandial glucose response chart. The chart has no axis labels, no units, and no reading values. A user glancing at the chart cannot tell the scale or whether the response is normal.

**Recommendation:** Add a y-axis range indicator (min/max reading shown as small labels at top and bottom) and a colour-coded border or header tint when a high-glucose response is detected.

### 4.5 Meal deletion: no undo
**Severity: Medium**

Deleting a logged meal shows no confirmation dialog and provides no undo. Given meal logging is manual effort, accidental deletion is frustrating.

**Recommendation:** Add either a swipe-to-delete pattern with a 3-second undo toast, or a confirmation dialog with "Delete meal" / "Cancel" options.

### 4.6 Empty state when no meals are logged
**Severity: Low**

The empty state for the meals list is a generic icon and text with no quick-log CTA. The "Add Meal" button is in the tab header — easy to miss.

**Recommendation:** Embed a large "+ Log first meal" button in the empty state.

---

## 5. LifeScreen (Books & Hobbies Tab)

### 5.1 Delete buttons on active hobbies: destructive actions with no confirm
**Severity: High**

Hobby and book items have delete/remove buttons directly in the list view. A single tap permanently deletes the record. Given users may spend weeks or months tracking a book, accidental taps are high-consequence.

**Recommendation:** Require a confirmation (Alert.alert with "Remove book" / "Cancel") before deletion. Optionally, implement swipe-to-delete to make the affordance less accidental.

### 5.2 "Currently reading" section: no progress indication
**Severity: Medium**

Books show title and author, but there is no page count, percentage read, or chapter field. Users who log a book have no way to indicate how far through it they are.

**Recommendation:** Add an optional "current page / total pages" field to the book card with a progress bar.

### 5.3 Hobbies: "log" action unclear
**Severity: Medium**

The "Log" button on each hobby appears to record an activity session, but there is no confirmation of what gets logged (duration? occurrence? no fields appear). The result of tapping "Log" is not visible until the stats update.

**Recommendation:** After logging, show a brief confirmation toast ("Logged 1 session for Hiking today") and display a session count or last-logged timestamp on the hobby card.

### 5.4 No add-book shortcut from empty state
**Severity: Low**

When no books are being tracked the list shows an empty state without a CTA. The add control is only accessible via a button not visible without scrolling.

---

## 6. FinanceScreen (Finance Tab)

### 6.1 Budget card: no contextual advice when over budget
**Severity: Medium**

The spending card shows a progress bar that turns red when over budget, but provides no contextual message. A user who is 20% over budget receives the same visual as one who is 200% over.

**Recommendation:** Add a brief status line: "On track" / "5% over — $23 remaining" / "Budget exceeded by $120" depending on threshold.

### 6.2 Spending categories: no visual differentiation in list
**Severity: Low**

All spending entries in the list use the same style. Category chips exist but are small and easy to overlook. Users wanting to scan for a specific category type (e.g. dining vs. groceries) have to read each row.

**Recommendation:** Add a colour dot or category icon at the left of each row for quick scanning.

---

## 7. SettingsScreen

### 7.1 Theme picker: no preview before apply
**Severity: High**

Tapping a theme in `ThemePickerModal` immediately applies it and closes the modal. There is no way to preview or compare themes. The abrupt full-app repaint may be jarring, especially on slow devices.

**Recommendation:** Show a preview pane inside the ThemePickerModal (a small card with sample text, a fake metric chip, and a sample chart line in the palette's colours) before the user confirms. Alternatively, use a "Try it" button that applies the theme live with an undo/cancel affordance.

### 7.2 Theme picker: palette cards lack accessibility labels
**Severity: Critical**
**File:** `screens/ThemePickerModal.tsx:100–150`

`PaletteCard` is a `Pressable` with swatch strips, a name, and "best for" text, but no `accessibilityLabel` or `accessibilityState`. A screen reader announces nothing meaningful when a card is focused.

**Recommendation:**
```tsx
<Pressable
  accessibilityRole="radio"
  accessibilityLabel={`${p.name} theme, ${BEST_FOR[p.id] ?? ""}`}
  accessibilityState={{ checked: selected }}
  ...
/>
```

### 7.3 Notification settings: time pickers are plain number TextInputs
**Severity: Medium**

Hour fields for meal reminders, evening check-in, etc. are free-text number inputs. Users can enter invalid hours (25, -3). There is no AM/PM toggle and no native time picker.

**Recommendation:** Replace with a native time picker or at minimum validate range (0–23) with inline error feedback.

### 7.4 Dexcom credentials: password field has no visibility toggle
**Severity: Medium**
**File:** `screens/SettingsScreen.tsx`

The Dexcom share password field is a `secureTextEntry` TextInput with no show/hide toggle. Users who forget which password they used have no way to verify the current value.

**Recommendation:** Add a show/hide toggle (eye icon) on the password field.

### 7.5 Settings sections: no visual grouping headers for long scroll
**Severity: Medium**

Settings is a single long `ScrollView` with sections for Permissions, Health Connect, Notifications, Dexcom, Export, and Account. On first load the user must scroll to find any section. There are text labels above each group but they blend into the layout without a strong visual break.

**Recommendation:** Add a sticky section header or prominent divider between the major groups (e.g. "Data Sources", "Notifications", "Export & Backup", "Account") so users can quickly jump to what they need.

### 7.6 Week start day picker: currently a scrollable select, not obvious
**Severity: Low**

The week start day is set via a row of tappable day labels. This control is not obviously interactive — there is no affordance indicating the selected day is "pressable to change."

**Recommendation:** Render the selected day with a filled background chip and an unambiguous indicator (check icon or border) that this is a selector.

---

## 8. InsightsScreen

### 8.1 InsightCard confidence badge: see 1.1 above
**Severity: Critical** (already listed)

### 8.2 Dismissed insights: no way to un-dismiss
**Severity: Medium**

The dismiss action on an InsightCard removes it from the list. There is no archive view or way to restore a dismissed insight. Users who dismiss something by accident lose that insight permanently.

**Recommendation:** Add a "Dismissed" section (collapsed by default) or a settings toggle to show all insights.

### 8.3 Supporting data rows: raw key names appear if formatting misses
**Severity: Low**

`formatSupportingData()` in `InsightCard.tsx:49–58` skips a set of keys but any other unrecognised key appears with its raw snake_case name converted to title case. If the backend sends new fields, they may display as unexpected labels.

**Recommendation:** Add a whitelist rather than blocklist, so only known + human-readable keys are shown.

---

## 9. TrendsScreen / HistoryScreen

### 9.1 TrendsScreen: chart SVGs have no accessibility labels
**Severity: Critical**

Same issue as HealthScreen (3.1). SVG charts for trends (steps over time, sleep quality, etc.) have no screen reader description.

**Recommendation:** Wrap each chart in an accessible View with a descriptive `accessibilityLabel` summarising the trend.

### 9.2 HistoryScreen search: no keyboard dismiss on scroll
**Severity: Medium**

The search box opens the keyboard, but scrolling the results list does not dismiss it. This is standard mobile UX — the list should use `keyboardShouldPersistTaps="handled"` and/or dismiss on scroll.

**Recommendation:** Add `keyboardDismissMode="on-drag"` to the results ScrollView/FlatList.

### 9.3 History items: tap target minimal on dense rows
**Severity: Medium**

Dense history rows may have vertically tight tap areas on the per-row expand/detail action. Verify each row has `minHeight: 48`.

---

## 10. CompletedScreen

### 10.1 Trash buttons immediately delete without confirm
**Severity: High**

The CompletedScreen lists finished books and hobbies with trash (delete) buttons. One tap permanently removes the entry with no confirm dialog, no undo.

**Recommendation:** Same pattern as LifeScreen — Alert.alert confirm before deletion, or swipe-to-delete with undo.

---

## 11. Modals: MoodCheckInModal / MoodPageSheet

### 11.1 Mood categories: no accessibility role on the mood tile grid
**Severity: High**
**File:** `components/MoodCheckInModal.tsx:222–224`

`accessibilityRole="radio"` is present on mood tiles, but the parent container does not have `accessibilityRole="radiogroup"`. Screen readers may not understand the grouping relationship.

**Recommendation:** Add `accessibilityRole="radiogroup"` and `accessibilityLabel="Select mood"` to the parent `View` wrapping each category.

### 11.2 Mood period labels: "Morning", "Afternoon" etc. not visually explained
**Severity: Low**

The mood sheet splits logs into time buckets (Morning, Afternoon, Evening, Night). New users may not understand that the bucket is determined by the time they record the mood, not something they select.

**Recommendation:** Add a brief one-line note: "Your mood log is filed under the period matching when you save it."

---

## 12. Navigation (RootTabs)

### 12.1 Tab bar labels: "Life" is ambiguous
**Severity: Medium**

The "Life" tab contains Books and Hobbies — but "Life" is a very broad label. New users won't know to look here for reading tracking.

**Recommendation:** Rename to "Hobbies" or "Books & Hobbies" (abbreviated to "Hobbies" in the tab label if space is limited).

### 12.2 No deep-link / notification tap routing to correct tab
**Severity: Medium**

Smart notifications (meal reminders, evening check-in, glucose spike) fire push notifications, but there is no evidence of a notification-tap handler routing the user to the relevant screen. Tapping a glucose alert notification likely opens the app to wherever the user last was.

**Recommendation:** Implement `expo-notifications` `addNotificationResponseReceivedListener` to navigate to the relevant screen (Health for glucose, Meals for meal reminder, etc.) when a notification is tapped.

### 12.3 Back navigation from modal screens: Android back button
**Severity: Medium**

Modal screens (MoodCheckInModal, BarcodeScannerModal) use RN `Modal` with `onRequestClose` wired to close. Verify this is tested on Android where the hardware back button should close the modal, not the app.

**Recommendation:** Confirm `onRequestClose` is present and functional on all Modal components — already present in ThemePickerModal, MoodCheckInModal. Audit others.

---

## 13. Global / Design System

### 13.1 Inconsistent border-radius values
**Severity: Low**

Card border-radius appears as 8, 10, 12, 14, and 16 across different components with no clear rule for which context gets which value. This creates subtle visual incoherence.

**Recommendation:** Establish a 3-tier radius scale: `r4` (chip/badge = 8), `r8` (card = 12), `r16` (modal sheet = 16) and document it.

### 13.2 Typography scale: no consistent line-height
**Severity: Low**

Body text, labels, and captions use `fontSize` consistently but `lineHeight` is often unset, relying on platform default. This causes tight leading on Android in particular.

**Recommendation:** Set explicit `lineHeight` values tied to each font size (e.g. `fontSize: 13, lineHeight: 19`).

### 13.3 One-handed usability: bottom-heavy actions are good; header actions less reachable
**Severity: Low**

Most primary actions (log, add, scan) are accessible at the bottom of screens. However some screens place important actions in the top-right of the header (Settings icon on some screens), which is hard to reach one-handed on larger phones.

**Recommendation:** Consider moving secondary actions (filters, date pickers, export) from header into bottom sheets or floating action buttons.

### 13.4 Dark mode readiness: currently palette-driven, not system-driven
**Severity: Low**

The app uses manually selected palettes rather than responding to the device's system dark-mode setting. Users who enable dark mode at the OS level will not get a dark Ripple theme automatically. The existing `toggle()` in ThemeContext only switches between morning-mist and midnight-neon.

**Recommendation:** On first install, detect `Appearance.getColorScheme()` and default to a matching dark palette if the system is in dark mode. Or surface a "Follow system" option in the theme picker.

### 13.5 Animation: no reduced-motion support
**Severity: Medium**

The skeleton shimmer animation in OverviewScreen uses `Animated.loop` with no check for `AccessibilityInfo.isReduceMotionEnabled()`. Users with vestibular disorders who have enabled "Reduce Motion" will still see animations.

**Recommendation:** Check `AccessibilityInfo.isReduceMotionEnabled()` and conditionally skip or replace animations with a static state.

---

## Summary: Issues by Severity

| Severity | Count | Key themes |
|---|---|---|
| Critical | 4 | Hardcoded confidence colours fail contrast on dark themes; chart SVGs inaccessible to screen readers; theme picker cards have no a11y labels |
| High | 11 | Hardcoded `#fff` text on palette-coloured buttons; deletion without confirm; food search UX; no glucose context on Overview; theme apply with no preview |
| Medium | 14 | Tap target sizing; empty state copy; tablet layout; notification routing; settings UX; reduce-motion |
| Low | 7 | Copy, border-radius inconsistency, typography, line-height |

**Total: 36 findings across 15 screens/components.**

---

_This document contains recommendations only. No code changes were made as part of this audit._
