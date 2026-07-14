# Ripple Health — Frontend (CLAUDE.md)

Expo/React Native (TypeScript) app, "Ripple Health." Talks to the backend at `https://app.kels.gg/api`.

## Critical operational rules

- **Do NOT run `eas build` without explicit user approval.** EAS build credits are limited and nearly exhausted at times — batch ALL native-touching changes (native modules, permissions, icon assets, Health Connect, foreground services, notification config) together and only build when explicitly told to.
- JS-only changes (screens, styling, navigation logic, API calls) need no approval — test freely via the dev server (`npx expo start`).
- Metro dev server runs on port 8081. Backend is at `https://app.kels.gg/api` (real HTTPS — the app cannot use plain `http://` in a real build; Android blocks cleartext traffic by default).

## App identity

- Name: **Ripple Health**
- Icon: four-quadrant droplet, thin black outline (`#111111`), black pulse/heartbeat line through center, centered, on cream background (`#FBFAF7`)
- Current quadrant colors: teal `#3FA0A6` (top-left), coral `#E8654E` (top-right), purple `#7B3FBF` (bottom-left), berry-wine `#A62A50` (bottom-right) — chosen specifically to avoid resembling Google Health's palette; don't drift back toward teal/blue/green-dominant schemes.

## Theme / metric color mapping (current)

- **Steps** (+ reading/hobbies as "activity") → teal `#3FA0A6`
- **Food/Meals** → coral `#E8654E`
- **Finance** → purple `#7B3FBF`
- **Glucose & heart rate** (default/in-range) → berry-wine `#A62A50` — BUT high/low glucose ALERTS must shift to a distinct urgent red (e.g. `#C0392B`) so alerts visually stand out from the normal berry tone
- **Mood** → a lighter violet, distinct from finance's purple
- **Water** → a complementary blue
- **Sleep** → a muted indigo/lavender
- Cream page background: `#F5F1E8` (slightly deeper than the original `#FBFAF7`)

## Navigation

- Bottom nav order: **Health, Meals, Home (raised center button), Life, Finance** — Home is a filled circle (teal) floating above the tab bar line, not a flat tab like the others. Thin dividers between each tab item.
- Settings is accessed via a header gear icon (stack navigation pushed on top), NOT a 6th bottom tab — this was a deliberate choice to preserve the 5-tab-plus-center-button layout.

## Icon library gotchas

- The actual app uses **Ionicons** via `@expo/vector-icons`. (Note: Tabler icon names like `ti-pizza`/`ti-heartbeat` were used in chat-based design mockups only and do NOT apply to this codebase — always verify Ionicons names actually render in Expo Go before finalizing, since some assumed equivalents may not exist.)
- Health → `heart`, Meals → `restaurant` or `fast-food` (verify which renders best), Home → `home`, Life → `book`, Finance → `wallet`.

## Common bug pattern to check first

Multiple "this feature doesn't work" reports this project turned out to be **working backend logic with no UI ever displaying the result** (book progress, hobby logging, water tracking). Before rewriting a log/save function, check whether the data is actually landing in the database — if it is, the fix is a display/UI wiring issue, not the underlying logic.

## Settings permission checks

Any screen showing system permission status (notifications, battery optimization, Health Connect) MUST re-check the ACTUAL current system state on screen focus (`useFocusEffect`), not just on mount — the user often leaves to Android's own settings screens and returns, and a mount-only check will show stale/wrong status.

## Correlation / pattern language (UI copy)

Any UI text describing a pattern across data must stay descriptive, never diagnostic:
- Single day → gentle observation ("glucose climbed after lunch today")
- Repeated pattern across multiple days → stronger language OK, but must cite the count ("4 of the last 5 days")
- Never phrase things as medical advice or a causal claim ("your lunch is spiking your blood sugar" is NOT acceptable phrasing)

## Backend

- Backend runs in a single `screen -S wellness` session on the VPS
- Always check `screen -ls` before starting a new session — never run `npm run dev` outside the existing session
- If the session is dead, restart with: `screen -dmS wellness bash -c 'cd /root/wellness-app/backend && npm run dev 2>&1 | tee /tmp/wellness-backend.log'`

## Git

- Repo under git. Commit checkpoints after each confirmed-working feature.
- Don't regenerate shared files (`client.ts`, theme files) wholesale when adding a new feature — add to them.
