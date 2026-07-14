// Color tokens for the Ripple Health palette.
// Brand anchor: teal #3FA0A6 (activity), coral #E8820E (food), purple #7B3FBF (finance), berry #A62A50 (glucose/HR).
// All metric ramps harmonise with these four icon quadrant colors.

export const lightTheme = {
  page: "#F5F1E8",
  card: "#ffffff",
  cardBorder: "#e7e3d8",
  textStrong: "#2C2C2A",
  textSoft: "#6b6a63",

  // Activity — steps, books, hobbies — icon top-left
  teal:   { bg: "#C2E9EB", fg: "#1A5C62", sub: "#2A8490", bar: "#3FA0A6" },
  // Food / meals — icon top-right
  coral:  { bg: "#FFE4C2", fg: "#6A3800", sub: "#C46210" },
  // Water — complementary mid blue
  blue:   { bg: "#C0DAF2", fg: "#0D3E70", sub: "#1A5AA0" },
  // Sleep — muted indigo-lavender (key name "amber" kept for backward compat with colorKey refs)
  amber:  { bg: "#D0D4F3", fg: "#2E3070", sub: "#4C52A0" },
  // Finance — icon bottom-left purple
  purple: { bg: "#E0CEFB", fg: "#3A1870", sub: "#5A2A9C" },
  // Glucose & heart rate (normal/in-range) — icon bottom-right berry-wine
  berry:  { bg: "#F2C8D5", fg: "#5A0E24", sub: "#821E3C", bar: "#A62A50" },
  // Mood — lighter violet, distinct from finance purple
  violet: { bg: "#E6D5FB", fg: "#48186E", sub: "#7040A8" },
  // Glucose alert / high-low danger states — brighter urgent red (distinct from berry resting tone)
  red:    { bg: "#FBCBC8", fg: "#7A1408", sub: "#C0392B" },
  // Backward-compat aliases so stray pink/green refs keep rendering sensibly
  pink:   { bg: "#F2C8D5", fg: "#5A0E24", sub: "#821E3C" },
  green:  { bg: "#E0CEFB", fg: "#3A1870", sub: "#5A2A9C" },
  brown:  { sub: "#6F4518" },
};

export const darkTheme = {
  page: "#211F1B",
  card: "#2A2824",
  cardBorder: "#3a372f",
  textStrong: "#F2F0EA",
  textSoft: "#B4B1A8",

  teal:   { bg: "#0E3E44", fg: "#85D9E0", sub: "#5CC0C8", bar: "#4BB5BC" },
  coral:  { bg: "#452400", fg: "#FFB870", sub: "#E07A28" },
  blue:   { bg: "#0A2E58", fg: "#8AC4F2", sub: "#5CA0DC" },
  amber:  { bg: "#1E224A", fg: "#B0B5F5", sub: "#8085DC" },
  purple: { bg: "#2A1050", fg: "#C8A8F8", sub: "#A070E0" },
  berry:  { bg: "#3E0A1A", fg: "#F0A0BC", sub: "#CE5A80", bar: "#C0607A" },
  violet: { bg: "#280A45", fg: "#CCA8FB", sub: "#A874E8" },
  red:    { bg: "#5A1008", fg: "#F5A09A", sub: "#E04535" },
  pink:   { bg: "#3E0A1A", fg: "#F0A0BC", sub: "#CE5A80" },
  green:  { bg: "#2A1050", fg: "#C8A8F8", sub: "#A070E0" },
  brown:  { sub: "#C8956A" },
};

export type Theme = typeof lightTheme;
